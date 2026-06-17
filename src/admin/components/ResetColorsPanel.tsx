import * as React from 'react';
import { Flex, Button, Typography } from '@strapi/design-system';
import { useForm } from '@strapi/strapi/admin';
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/content-manager/strapi-admin';

/**
 * A Content Manager edit-view **side panel** that resets every `global::color`
 * field back to its schema `default`. Generic: the defaults are read straight
 * from the content type's attributes (no hardcoded list), so it works for the
 * Theme and any future content type that uses color fields with defaults.
 *
 * Writing through the form's `onChange` marks the form dirty — the user still
 * has to Save/Publish, so a misclick is recoverable by leaving without saving.
 */

const ResetColorsContent = ({ defaults }: { defaults: Array<[string, string]> }) => {
  const onChange = useForm('ResetColors', (state) => state.onChange);
  const [confirming, setConfirming] = React.useState(false);

  const apply = () => {
    for (const [name, value] of defaults) {
      onChange(name, value);
    }
    setConfirming(false);
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={2} width="100%">
      {confirming ? (
        <>
          <Typography variant="pi" textColor="danger600">
            Ghi đè {defaults.length} màu về mặc định? Chưa lưu cho đến khi bạn bấm Save.
          </Typography>
          <Flex gap={2}>
            <Button variant="danger" onClick={apply} fullWidth>
              Khôi phục
            </Button>
            <Button variant="tertiary" onClick={() => setConfirming(false)} fullWidth>
              Huỷ
            </Button>
          </Flex>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={() => setConfirming(true)} fullWidth>
            Khôi phục màu mặc định
          </Button>
          <Typography variant="pi" textColor="neutral500">
            Đặt lại tất cả màu về giá trị mặc định trong schema.
          </Typography>
        </>
      )}
    </Flex>
  );
};

const ResetColorsPanel = () => {
  const ctx = useContentManagerContext();
  const attributes = (ctx?.contentType?.attributes ?? {}) as Record<
    string,
    { type?: string; customField?: string; default?: unknown }
  >;

  // Collect every color field that declares a default.
  const defaults = Object.entries(attributes)
    .filter(([, a]) => a.customField === 'global::color' && typeof a.default === 'string')
    .map(([name, a]) => [name, a.default as string] as [string, string]);

  if (defaults.length === 0) {
    return null;
  }

  return {
    title: 'Màu mặc định',
    content: <ResetColorsContent defaults={defaults} />,
  };
};

export default ResetColorsPanel;
