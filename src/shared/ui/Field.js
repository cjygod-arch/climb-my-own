/**
 * shared/ui/Field.js — 입력 필드.
 *
 * StepFlow 안에서만 쓰인다는 전제로 만들었다. 한 화면에 필드 그룹은 하나다.
 * 수치 입력은 계기판 톤을 유지하기 위해 크게(26px/800) 표시한다.
 */

import { el } from '../../core/dom.js';

/**
 * @param {{
 *   label: string,
 *   name: string,
 *   type?: string,
 *   value?: string|number,
 *   placeholder?: string,
 *   suffix?: string,
 *   inputMode?: string,
 *   step?: string,
 *   min?: string,
 *   max?: string,
 *   big?: boolean,
 *   hint?: string,
 *   onInput?: (value: string) => void
 * }} props
 * @returns {HTMLElement}
 */
export function Field({
  label,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  suffix = null,
  inputMode,
  step,
  min,
  max,
  big = false,
  hint = null,
  onInput,
}) {
  const input = el('input', {
    class: ['field__input', big && 'field__input--num'],
    id: `f-${name}`,
    name,
    type,
    value: String(value ?? ''),
    placeholder,
    inputmode: inputMode,
    step,
    min,
    max,
    autocomplete: 'off',
    onInput: (e) => onInput?.(e.target.value),
  });

  return el('div', { class: 'field' }, [
    el('label', { class: 't-label', for: `f-${name}`, text: label }),
    suffix
      ? el('div', { class: 'field__row' }, [input, el('span', { class: 'field__suffix', text: suffix })])
      : input,
    hint && el('span', { class: 't-caption', text: hint }),
  ]);
}

/**
 * @param {{ label: string, name: string, value?: string, placeholder?: string, hint?: string, onInput?: (v:string)=>void }} props
 */
export function TextArea({ label, name, value = '', placeholder = '', hint = null, onInput }) {
  return el('div', { class: 'field' }, [
    el('label', { class: 't-label', for: `f-${name}`, text: label }),
    el('textarea', {
      class: 'field__textarea',
      id: `f-${name}`,
      name,
      placeholder,
      onInput: (e) => onInput?.(e.target.value),
    }, [String(value ?? '')]),
    hint && el('span', { class: 't-caption', text: hint }),
  ]);
}

/**
 * @param {{ label: string, name: string, value?: string, options: Array<{value:string,label:string}>, placeholder?: string, onChange?: (v:string)=>void }} props
 */
export function Select({ label, name, value = '', options, placeholder = null, onChange }) {
  return el('div', { class: 'field' }, [
    el('label', { class: 't-label', for: `f-${name}`, text: label }),
    el(
      'select',
      {
        class: 'field__select',
        id: `f-${name}`,
        name,
        onChange: (e) => onChange?.(e.target.value),
      },
      [
        placeholder && el('option', { value: '', text: placeholder, selected: value === '' }),
        ...options.map((opt) =>
          el('option', { value: opt.value, text: opt.label, selected: opt.value === value || undefined }),
        ),
      ],
    ),
  ]);
}
