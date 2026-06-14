import * as React from 'react';
import { Flex, Field, DateTimePicker, Typography } from '@strapi/design-system';
import { useField } from '@strapi/strapi/admin';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/content-manager/strapi-admin';

/**
 * A Content Manager edit-view **side panel** (right column, next to Publish) for scheduling.
 * Registered via `apis.addEditViewSidePanel`. A side panel is a function that returns
 * `{ title, content }` — or `null` to not render — and may use hooks.
 *
 * Renders `startAt` / `endAt` DateTimePickers and only appears for content types that
 * declare both fields.
 */

const ScheduleField = ({
  name,
  label,
  error,
}: {
  name: string;
  label: string;
  error?: string;
}) => {
  const field = useField<string | null>(name);
  const value = field.value ? new Date(field.value) : undefined;

  return (
    <Field.Root name={name} error={error || field.error}>
      <Field.Label>{label}</Field.Label>
      <DateTimePicker
        value={value}
        onChange={(date?: Date) => field.onChange(name, date ? date.toISOString() : null)}
        onClear={() => field.onChange(name, null)}
      />
      <Field.Error />
    </Field.Root>
  );
};

const ScheduleContent = () => {
  const start = useField<string | null>('startAt');
  const end = useField<string | null>('endAt');

  // Mirror the server rule: startAt must be strictly before endAt.
  const invalid =
    !!start.value && !!end.value && Date.parse(start.value) >= Date.parse(end.value);
  const windowError = invalid ? 'Bắt đầu phải trước Kết thúc' : undefined;

  return (
    <Flex direction="column" alignItems="stretch" gap={4} width="100%">
      <ScheduleField name="startAt" label="Bắt đầu" />
      <ScheduleField name="endAt" label="Kết thúc" error={windowError} />
      <Typography variant="pi" textColor={invalid ? 'danger600' : 'neutral500'}>
        {invalid
          ? 'Khoảng thời gian không hợp lệ — không lưu/đăng được.'
          : 'Để trống = không giới hạn. Giờ theo múi giờ trình duyệt.'}
      </Typography>
    </Flex>
  );
};

const SchedulePanel = () => {
  const ctx = useContentManagerContext();
  const attributes = (ctx?.contentType?.attributes ?? {}) as Record<string, { type?: string }>;

  // Only show for content types that opted into scheduling.
  if (!attributes.startAt || !attributes.endAt) {
    return null;
  }

  return {
    title: 'Lịch hiển thị',
    content: <ScheduleContent />,
  };
};

export default SchedulePanel;
