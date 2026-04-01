"""跨平台云端服务启动器。

start:      docker 数据库 + 后端/前端热重载
stop:       停止后端/前端 + docker 数据库
restart:    停止后启动
status:     显示本地进程和 docker 状态
db-upgrade: 更新数据库到最新迁移
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional


ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "后端"
FRONTEND_DIR = ROOT_DIR / "前端"
SCRIPT_NAME = Path(__file__).name
STATE_DIR = ROOT_DIR / ".cache" / ".dev"
STATE_FILE = STATE_DIR / "config.json"
BACKEND_LOG = STATE_DIR / "backend.log"
FRONTEND_LOG = STATE_DIR / "frontend.log"
ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
ANSI_RESET = "\033[0m"
ANSI_GREEN = "\033[32m"
ANSI_YELLOW = "\033[33m"
ANSI_RED = "\033[31m"


def echo(msg: str) -> None:
    print(f"==> {msg}", flush=True)


def 支持彩色输出() -> bool:
    return sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def 格式化状态符号(symbol: str, color: str) -> str:
    if not 支持彩色输出():
        return symbol
    return f"{color}\033[1m{symbol}{ANSI_RESET}"


def 格式化状态行(symbol: str, msg: str, *, color: str, 宽度: int, 结果: str = "") -> str:
    主体 = msg.ljust(宽度)
    if 结果:
        主体 = f"{主体} {结果}"
    return f" {格式化状态符号(symbol, color)} {主体}"


def 开始单行状态(msg: str, *, 宽度: int) -> None:
    line = 格式化状态行("-", msg, color=ANSI_YELLOW, 宽度=宽度)
    if sys.stdout.isatty():
        print(line, end="\r", flush=True)
        return
    print(line)


def 结束单行状态(msg: str, *, 宽度: int, 结果: str, 成功: bool = True) -> None:
    symbol = "✓" if 成功 else "x"
    color = ANSI_GREEN if 成功 else ANSI_RED
    line = 格式化状态行(symbol, msg, color=color, 宽度=宽度, 结果=结果)
    if sys.stdout.isatty():
        print(f"\r\033[2K{line}", flush=True)
        return
    print(line)


def 查找命令(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(f"未找到命令: {name}")


def 解析_dotenv(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        data[key] = value
    return data


def 获取可用_env_文件() -> Optional[Path]:
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        return env_file
    example_file = ROOT_DIR / ".env.example"
    if example_file.exists():
        return example_file
    return None


def 确保_env_文件() -> bool:
    env_file = ROOT_DIR / ".env"
    example_file = ROOT_DIR / ".env.example"
    if env_file.exists() or not example_file.exists():
        return False
    echo("未找到 .env，正在从 .env.example 复制")
    shutil.copyfile(example_file, env_file)
    return True


def 组合_env_参数() -> list[str]:
    env_file = 获取可用_env_文件()
    if env_file is None:
        return []
    return ["--env-file", env_file.name]


def 读取根环境变量() -> dict[str, str]:
    env_file = 获取可用_env_文件()
    if env_file is None:
        return {}
    return 解析_dotenv(env_file)


def 读取状态() -> Optional[dict]:
    if not STATE_FILE.exists():
        return None
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None


def 写入状态(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def 提取进程_pid(state: dict) -> tuple[int, int]:
    processes = state.get("processes")
    if not isinstance(processes, dict):
        return 0, 0
    backend_pid = int(processes.get("backend", 0))
    frontend_pid = int(processes.get("frontend", 0))
    return backend_pid, frontend_pid


def 保存进程状态(backend_pid: int, frontend_pid: int) -> None:
    state = 读取状态() or {}
    state["processes"] = {
        "backend": backend_pid,
        "frontend": frontend_pid,
    }
    写入状态(state)


def 保存依赖哈希(key: str, digest: str) -> None:
    state = 读取状态() or {}
    state["hash"] = state.get("hash", {})
    state["hash"][key] = digest
    写入状态(state)


def 读取依赖哈希(key: str) -> Optional[str]:
    state = 读取状态()
    if state is None:
        return None
    hashes = state.get("hash")
    if not isinstance(hashes, dict):
        return None
    value = hashes.get(key)
    return str(value) if value else None


def 计算文件哈希(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def 解析_npm_命令() -> list[str]:
    if os.name == "nt":
        for name in ("npm.cmd", "npm.exe", "npm"):
            path = shutil.which(name)
            if path:
                return [path]
        raise RuntimeError("未找到命令: npm（请确认 Node.js 安装目录已加入 PATH）")
    查找命令("npm")
    return ["npm"]


def 选择依赖文件(directory: Path) -> Path:
    lock_file = directory / "package-lock.json"
    if lock_file.exists():
        return lock_file
    package_file = directory / "package.json"
    if package_file.exists():
        return package_file
    raise RuntimeError(f"未找到依赖描述文件: {directory}")


def 确保_node_依赖(directory: Path, *, 名称: str, 哈希键: str) -> None:
    npm_cmd = 解析_npm_命令()
    node_modules = directory / "node_modules"
    desc_file = 选择依赖文件(directory)
    current_hash = 计算文件哈希(desc_file)
    saved_hash = 读取依赖哈希(哈希键)

    if node_modules.exists() and saved_hash == current_hash:
        return

    if not node_modules.exists():
        echo(f"首次安装{名称}依赖")
    else:
        echo(f"检测到{名称}依赖描述变化，重新安装依赖")

    subprocess.run([*npm_cmd, "install"], check=True, cwd=directory)
    保存依赖哈希(哈希键, current_hash)
    echo(f"{名称}依赖安装完成")


def 存在进程(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def 停止进程(pid: int) -> None:
    if pid <= 0:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return

    killpg = getattr(os, "killpg", None)
    if callable(killpg):
        try:
            killpg(pid, signal.SIGTERM)
            return
        except ProcessLookupError:
            return
        except Exception:
            pass

    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return


def 停止开发版进程() -> None:
    state = 读取状态()
    if state is None:
        print("未找到本地开发进程记录。")
        return

    backend_pid, frontend_pid = 提取进程_pid(state)

    for name, pid in (("backend", backend_pid), ("frontend", frontend_pid)):
        if pid <= 0:
            continue
        if 存在进程(pid):
            停止进程(pid)
            print(f"已停止 {name} (PID={pid})")
        else:
            print(f"{name} 已停止 (PID={pid})")

    保存进程状态(0, 0)


def 启动_docker_desktop() -> None:
    if os.name != "nt":
        return

    docker_desktop = Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe")
    if docker_desktop.exists():
        echo("Docker 未运行，正在启动 Docker Desktop")
        subprocess.Popen(
            [str(docker_desktop)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return

    raise RuntimeError("未找到 Docker Desktop，请手动启动 Docker。")


def docker_是否运行() -> bool:
    result = subprocess.run(
        ["docker", "info"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def 检查_docker_运行() -> None:
    if docker_是否运行():
        return

    启动_docker_desktop()
    echo("等待 Docker 启动...")
    for _ in range(30):
        if docker_是否运行():
            echo("Docker 已启动")
            return
        time.sleep(2)

    raise RuntimeError("Docker 启动超时，请手动检查 Docker。")


def 镜像存在(image: str) -> bool:
    result = subprocess.run(
        ["docker", "image", "inspect", image],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def 解析_docker_compose_镜像(compose_path: Path) -> list[str]:
    images: list[str] = []
    for raw in compose_path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line.startswith("image:"):
            continue
        image = line.split(":", 1)[1].strip().strip("'\"")
        if image:
            images.append(image)
    return images


def 验证_docker_镜像(images: list[str]) -> None:
    宽度 = max(len(f"检查镜像: {image}") for image in images)
    for image in images:
        msg = f"检查镜像: {image}"
        开始单行状态(msg, 宽度=宽度)
        if 镜像存在(image):
            结束单行状态(msg, 宽度=宽度, 结果="（已存在）")
            continue

        result = subprocess.run(
            ["docker", "pull", image],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        if result.returncode != 0:
            结束单行状态(msg, 宽度=宽度, 结果="（拉取失败）", 成功=False)
            stderr = (result.stderr or "").strip()
            raise RuntimeError(
                "无法拉取 Docker 镜像。\n"
                f"镜像: {image}\n"
                f"错误: {stderr}"
            )
        结束单行状态(msg, 宽度=宽度, 结果="（已拉取）")


def 验证_docker_compose_镜像(compose_path: Path) -> None:
    echo(f"解析 compose 文件: {compose_path}")
    images = 解析_docker_compose_镜像(compose_path)
    if not images:
        echo("未找到需要拉取的镜像（所有服务均为 build 模式）")
        return

    echo(f"发现 {len(images)} 个镜像需要验证")
    查找命令("docker")
    检查_docker_运行()
    echo("开始验证镜像...")
    验证_docker_镜像(images)
    echo("所有镜像验证完成")


def 启动并转发日志(
    cmd: list[str],
    cwd: Path,
    log_path: Path,
    env_patch: Optional[dict[str, str]] = None,
    force_color: bool = False,
) -> subprocess.Popen:
    relay_env_patch: dict[str, str] = {}
    if env_patch:
        relay_env_patch.update(env_patch)
    if force_color:
        relay_env_patch.update(
            {
                "FORCE_COLOR": "1",
                "PY_COLORS": "1",
                "CLICOLOR_FORCE": "1",
                "TERM": "xterm-256color",
            }
        )
        relay_env_patch.pop("NO_COLOR", None)

    relay_cmd = [
        sys.executable,
        str(Path(__file__).resolve()),
        "__relay__",
        "--relay-cwd",
        str(cwd),
        "--relay-log",
        str(log_path),
        "--relay-cmd-json",
        json.dumps(cmd, ensure_ascii=False),
    ]
    if relay_env_patch:
        relay_cmd.extend(
            ["--relay-env-json", json.dumps(relay_env_patch, ensure_ascii=False)]
        )

    if os.name == "nt":
        return subprocess.Popen(
            relay_cmd,
            cwd=ROOT_DIR,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )

    setsid = getattr(os, "setsid", None)
    return subprocess.Popen(
        relay_cmd,
        cwd=ROOT_DIR,
        preexec_fn=setsid if callable(setsid) else None,
    )


def 运行日志转发模式(args: argparse.Namespace) -> int:
    if not args.relay_cwd or not args.relay_log or not args.relay_cmd_json:
        raise RuntimeError("日志转发模式参数不完整")

    cmd = json.loads(args.relay_cmd_json)
    if not isinstance(cmd, list) or not all(isinstance(item, str) for item in cmd):
        raise RuntimeError("日志转发命令格式错误")

    env = os.environ.copy()
    if args.relay_env_json:
        env_patch = json.loads(args.relay_env_json)
        if not isinstance(env_patch, dict):
            raise RuntimeError("日志转发环境变量格式错误")
        env.update({str(key): str(value) for key, value in env_patch.items()})

    process = subprocess.Popen(
        cmd,
        cwd=args.relay_cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    assert process.stdout is not None
    Path(args.relay_log).parent.mkdir(parents=True, exist_ok=True)
    with open(args.relay_log, "a", encoding="utf-8") as log_fp:
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            log_fp.write(ANSI_ESCAPE_RE.sub("", line))
            log_fp.flush()

    return process.wait()


def 获取开发数据库配置() -> dict[str, str]:
    env_map = 读取根环境变量()
    return {
        "POSTGRES_USER": env_map.get("POSTGRES_USER", "robotdog"),
        "POSTGRES_PASSWORD": env_map.get("POSTGRES_PASSWORD", "robotdog"),
        "POSTGRES_DB": env_map.get("POSTGRES_DB", "robotdog"),
        "DB_EXPOSE_PORT": env_map.get("DB_EXPOSE_PORT", "15432"),
    }


def 构建开发后端环境() -> dict[str, str]:
    db_config = 获取开发数据库配置()
    return {
        "NODE_ENV": "development",
        "PORT": "9000",
        "DB_HOST": "127.0.0.1",
        "DB_PORT": db_config["DB_EXPOSE_PORT"],
        "DB_NAME": db_config["POSTGRES_DB"],
        "DB_USER": db_config["POSTGRES_USER"],
        "DB_PASSWORD": db_config["POSTGRES_PASSWORD"],
        "FORCE_CONSOLE_LOGS": "1",
    }


def 获取生产访问地址() -> tuple[str, str]:
    env_map = 读取根环境变量()
    host = env_map.get("SERVER_NAME", "localhost").strip() or "localhost"
    if host == "_":
        host = "localhost"
    http_port = env_map.get("HTTP_PORT", "80").strip() or "80"
    port_suffix = "" if http_port == "80" else f":{http_port}"
    base_url = f"http://{host}{port_suffix}"
    return base_url, f"{base_url}/api/v1/health"


def 检查_api_健康(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return 200 <= response.status < 300
    except (urllib.error.URLError, TimeoutError):
        return False


def 更新开发数据库() -> None:
    os.chdir(ROOT_DIR)
    查找命令("docker")
    确保_node_依赖(BACKEND_DIR, 名称="后端", 哈希键="backend_package")
    检查_docker_运行()

    echo("启动数据库依赖")
    subprocess.run(
        ["docker", "compose", *组合_env_参数(), "up", "-d", "postgres"],
        check=True,
        cwd=ROOT_DIR,
    )

    env = os.environ.copy()
    env.update(构建开发后端环境())

    echo("执行开发数据库迁移")
    subprocess.run(
        [*解析_npm_命令(), "run", "migration:up"],
        check=True,
        cwd=BACKEND_DIR,
        env=env,
    )
    echo("开发数据库已更新到最新版本")


def 更新生产数据库() -> None:
    os.chdir(ROOT_DIR)
    查找命令("docker")
    检查_docker_运行()
    确保_env_文件()

    echo("启动生产数据库与后端容器")
    subprocess.run(
        ["docker", "compose", *组合_env_参数(), "up", "-d", "postgres", "backend"],
        check=True,
        cwd=ROOT_DIR,
    )

    echo("执行生产数据库迁移")
    subprocess.run(
        [
            "docker",
            "compose",
            *组合_env_参数(),
            "exec",
            "-T",
            "backend",
            "npm",
            "run",
            "migration:up",
        ],
        check=True,
        cwd=ROOT_DIR,
    )
    echo("生产数据库已更新到最新版本")


def 启动开发版() -> None:
    os.chdir(ROOT_DIR)
    查找命令("node")
    查找命令("docker")
    查找命令(sys.executable)
    npm_cmd = 解析_npm_命令()

    echo("检查 Docker 状态")
    检查_docker_运行()
    确保_env_文件()
    验证_docker_compose_镜像(ROOT_DIR / "docker-compose.yml")

    echo("启动开发数据库: postgres")
    subprocess.run(
        ["docker", "compose", *组合_env_参数(), "up", "-d", "postgres"],
        check=True,
        cwd=ROOT_DIR,
    )

    echo("停止本地开发进程")
    停止开发版进程()

    确保_node_依赖(BACKEND_DIR, 名称="后端", 哈希键="backend_package")
    确保_node_依赖(FRONTEND_DIR, 名称="前端", 哈希键="frontend_package")
    更新开发数据库()

    backend_cmd = [*npm_cmd, "run", "dev"]
    frontend_cmd = [*npm_cmd, "run", "dev", "--", "--host", "0.0.0.0", "--port", "5174"]

    echo("正在启动后端热重载")
    backend_proc = 启动并转发日志(
        backend_cmd,
        BACKEND_DIR,
        BACKEND_LOG,
        env_patch=构建开发后端环境(),
        force_color=True,
    )

    echo("正在启动前端热重载")
    frontend_proc = 启动并转发日志(
        frontend_cmd,
        FRONTEND_DIR,
        FRONTEND_LOG,
        force_color=True,
    )

    保存进程状态(backend_proc.pid, frontend_proc.pid)

    print("")
    print("本地开发环境已启动:")
    print("  前端: http://localhost:5174/")
    print("  后端: http://localhost:9000/api/v1/health")
    print(f"  后端日志: {BACKEND_LOG}")
    print(f"  前端日志: {FRONTEND_LOG}")
    print("")
    print(f"停止命令: {sys.executable} ./tools/{SCRIPT_NAME} --stop")
    print("按 Ctrl+C 可停止开发环境并退出。")

    上次中断时间 = 0.0
    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            当前时间 = time.monotonic()
            if 当前时间 - 上次中断时间 <= 2:
                print("")
                echo("检测到 Ctrl+C，正在停止开发环境")
                try:
                    停止开发版()
                except KeyboardInterrupt:
                    pass
                break
            上次中断时间 = 当前时间
            print("")
            echo("收到中断信号，再按一次 Ctrl+C 才会停止开发环境")
            continue

        state = 读取状态()
        if state is None:
            break
        backend_pid, frontend_pid = 提取进程_pid(state)
        if not 存在进程(backend_pid) and not 存在进程(frontend_pid):
            break


def 停止开发版() -> None:
    os.chdir(ROOT_DIR)
    停止开发版进程()

    if shutil.which("docker") is None or not docker_是否运行():
        echo("Docker 未运行，跳过停止数据库容器")
        return

    echo("正在停止数据库容器")
    subprocess.run(
        ["docker", "compose", *组合_env_参数(), "stop", "postgres"],
        check=False,
        cwd=ROOT_DIR,
    )


def 显示开发状态() -> None:
    os.chdir(ROOT_DIR)
    echo("Docker 依赖状态:")
    if shutil.which("docker") is None:
        print("Docker 未安装")
    elif not docker_是否运行():
        print("Docker 未运行")
    else:
        subprocess.run(
            ["docker", "compose", *组合_env_参数(), "ps", "postgres"],
            check=False,
            cwd=ROOT_DIR,
        )

    state = 读取状态()
    if state is None:
        print("未找到本地开发进程记录。")
        return

    backend_pid, frontend_pid = 提取进程_pid(state)
    print(f"后端: {'正在运行' if 存在进程(backend_pid) else '已停止'} (PID={backend_pid})")
    print(f"前端: {'正在运行' if 存在进程(frontend_pid) else '已停止'} (PID={frontend_pid})")


def 启动生产版() -> None:
    os.chdir(ROOT_DIR)
    查找命令("docker")

    echo("检查 Docker 状态")
    检查_docker_运行()
    确保_env_文件()
    验证_docker_compose_镜像(ROOT_DIR / "docker-compose.yml")

    echo("构建并启动生产容器")
    subprocess.run(
        ["docker", "compose", *组合_env_参数(), "up", "-d", "--build"],
        check=True,
        cwd=ROOT_DIR,
    )

    echo("等待服务启动")
    time.sleep(10)

    echo("检查容器状态")
    subprocess.run(
        ["docker", "compose", *组合_env_参数(), "ps"],
        check=False,
        cwd=ROOT_DIR,
    )

    frontend_url, health_url = 获取生产访问地址()
    if 检查_api_健康(health_url):
        echo("API 健康检查通过")
    else:
        echo("API 健康检查失败，请检查容器日志")

    print("")
    print("生产环境已启动:")
    print(f"  站点: {frontend_url}")
    print(f"  健康检查: {health_url}")


def 停止生产版() -> None:
    os.chdir(ROOT_DIR)
    echo("停止生产容器")
    subprocess.run(
        ["docker", "compose", *组合_env_参数(), "down"],
        check=False,
        cwd=ROOT_DIR,
    )


def 显示生产状态() -> None:
    os.chdir(ROOT_DIR)
    echo("生产容器状态:")
    subprocess.run(
        ["docker", "compose", *组合_env_参数(), "ps"],
        check=False,
        cwd=ROOT_DIR,
    )


def 解析参数() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="跨平台开发/生产启动器")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--start", action="store_true", help="启动环境")
    group.add_argument("--stop", action="store_true", help="停止环境")
    group.add_argument("--restart", action="store_true", help="重启环境（默认）")
    group.add_argument("--status", action="store_true", help="查看环境状态")
    group.add_argument("--db-upgrade", action="store_true", help="更新数据库到最新迁移")
    group.add_argument(
        "--verify-images",
        metavar="COMPOSE_FILE",
        help="验证 docker-compose.yml 中的镜像（传入 compose 文件路径）",
    )
    parser.add_argument("action", nargs="?", help="可选动作")
    parser.add_argument("--prod", action="store_true", help="使用生产模式")
    parser.add_argument("--relay-cwd", help=argparse.SUPPRESS)
    parser.add_argument("--relay-log", help=argparse.SUPPRESS)
    parser.add_argument("--relay-cmd-json", help=argparse.SUPPRESS)
    parser.add_argument("--relay-env-json", help=argparse.SUPPRESS)
    return parser.parse_args()


def main() -> int:
    args = 解析参数()
    if args.action == "__relay__":
        return 运行日志转发模式(args)

    if args.verify_images:
        compose_path = Path(args.verify_images)
        if not compose_path.exists():
            print(f"错误: 文件不存在: {compose_path}", file=sys.stderr)
            return 1
        try:
            验证_docker_compose_镜像(compose_path)
            return 0
        except Exception as exc:
            print(f"错误: {exc}", file=sys.stderr)
            return 1

    action = args.action or "restart"
    if action not in {"start", "stop", "restart", "status", "db-upgrade"}:
        raise RuntimeError(f"不支持的动作: {action}")

    if args.start:
        action = "start"
    elif args.stop:
        action = "stop"
    elif args.restart:
        action = "restart"
    elif args.status:
        action = "status"
    elif args.db_upgrade:
        action = "db-upgrade"

    try:
        if args.prod:
            if action == "start":
                启动生产版()
            elif action == "stop":
                停止生产版()
            elif action == "restart":
                停止生产版()
                启动生产版()
            elif action == "status":
                显示生产状态()
            elif action == "db-upgrade":
                更新生产数据库()
        else:
            if action == "start":
                启动开发版()
            elif action == "stop":
                停止开发版()
            elif action == "restart":
                停止开发版()
                启动开发版()
            elif action == "status":
                显示开发状态()
            elif action == "db-upgrade":
                更新开发数据库()
        return 0
    except subprocess.CalledProcessError as exc:
        print(f"命令执行失败，返回代码为: {exc.returncode}: {exc.cmd}", file=sys.stderr)
        return exc.returncode
    except Exception as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
