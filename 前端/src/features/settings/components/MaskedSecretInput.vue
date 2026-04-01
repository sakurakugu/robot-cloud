<template>
  <el-form-item :label="label">
    <el-input
      :model-value="modelValue"
      :readonly="readonly"
      :type="readonly || showValue ? 'text' : 'password'"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #append>
        <el-button-group>
          <el-button
            v-if="!readonly"
            :icon="View"
            @click="emit('toggle-visibility')"
          />
          <el-button
            v-if="readonly && hasValue"
            :icon="Edit"
            @click="emit('enable-edit')"
          />
          <el-button
            :icon="CopyDocument"
            :disabled="!clipboardPasteEnabled"
            @click="emit('paste')"
          />
        </el-button-group>
      </template>
    </el-input>
  </el-form-item>
</template>

<script setup lang="ts">
import { CopyDocument, Edit, View } from '@element-plus/icons-vue'

withDefaults(defineProps<{
  label: string
  modelValue: string
  readonly: boolean
  showValue: boolean
  placeholder: string
  hasValue: boolean
  clipboardPasteEnabled?: boolean
}>(), {
  clipboardPasteEnabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'toggle-visibility': []
  'paste': []
  'enable-edit': []
}>()
</script>
