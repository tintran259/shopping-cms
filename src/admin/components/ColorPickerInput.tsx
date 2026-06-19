import * as React from 'react';
import { useIntl } from 'react-intl';
import { Field, Flex } from '@strapi/design-system';

/**
 * Input for the `global::color` custom field (stores a CSS color string).
 * A native color swatch (hex picker) + a free text input (so hex, rgba(), or a
 * CSS color name can be typed) + a live preview chip. The text input is the source
 * of truth; the swatch only drives hex values.
 */

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type Props = {
  name?: string;
  value?: string | null;
  onChange?: (e: { target: { name: string; value: string; type: string } }) => void;
  attribute?: { type?: string };
  // Content Manager passes the configured ("Configure the view") label as a plain
  // string here; `intlLabel` is only the static custom-field registration label.
  label?: string;
  intlLabel?: { id: string; defaultMessage: string };
  labelAction?: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
};

const ColorPickerInput = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const { value, onChange, attribute, label, intlLabel, labelAction, required, error, hint, disabled } = props;
  const name = props.name ?? '';
  const { formatMessage } = useIntl();

  const str = typeof value === 'string' ? value : '';
  const swatch = HEX.test(str) ? str : '#000000';

  const emit = (v: string) =>
    onChange?.({ target: { name, value: v, type: attribute?.type ?? 'string' } });

  return (
    <Field.Root name={name} id={name} error={error} hint={hint} required={required}>
      <Field.Label action={labelAction}>
        {label || (intlLabel ? formatMessage(intlLabel) : name)}
      </Field.Label>
      <Flex gap={2} alignItems="center">
        <input
          type="color"
          aria-label={`${name} color picker`}
          value={swatch}
          disabled={disabled}
          onChange={(e) => emit(e.target.value)}
          style={{
            width: 38,
            height: 38,
            flex: '0 0 auto',
            border: '1px solid #dcdce4',
            borderRadius: 4,
            background: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: 2,
          }}
        />
        <Field.Input
          ref={ref}
          placeholder="#2563eb · rgba(…) · tomato"
          value={str}
          disabled={disabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => emit(e.target.value)}
        />
      </Flex>
      <Field.Hint />
      <Field.Error />
    </Field.Root>
  );
});

export default ColorPickerInput;
