import * as React from 'react';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';
import { Box, Button, Checkbox, Field, Flex, Modal } from '@strapi/design-system';
import { useStrapiApp } from '@strapi/strapi/admin';
import {
  Bold,
  Italic,
  Underline,
  StrikeThrough,
  Quotes,
  Code,
  CodeBlock,
  BulletList,
  NumberList,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  ArrowClockwise,
  ArrowsCounterClockwise,
  GridNine,
  Plus,
  Trash,
} from '@strapi/icons';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';

interface TiptapInputProps {
  name: string;
  // JSON custom field: value is { desktop, tablet, mobile } (object), or a legacy HTML string.
  value?: unknown;
  onChange: (event: { target: { name: string; type: string; value: unknown } }) => void;
  attribute?: { type?: string };
  intlLabel?: { id: string; defaultMessage: string };
  labelAction?: React.ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

// Strapi media asset shape (subset we need).
interface StrapiAsset {
  url: string;
  alternativeText?: string | null;
  name?: string;
  mime?: string;
}

const EMPTY_HTML = '<p></p>';

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px'];
const SPECIAL_CHARS = ['©', '®', '™', '€', '£', '¥', '§', '¶', '•', '—', '→', '←', '↑', '↓', '≈', '≠', '≤', '≥', '×', '÷', '°', '±', 'µ', 'Ω', 'π', '∞', '✓', '★', '♥'];

type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '400px' };

type DeviceDoc = Record<Device, string>;
const EMPTY_DOC: DeviceDoc = { desktop: '', tablet: '', mobile: '' };
const cleanHTML = (html: string) => (html === EMPTY_HTML ? '' : html);

// Accepts the stored object, a JSON string, or a legacy plain-HTML string (→ desktop).
const parseDoc = (v: unknown): DeviceDoc => {
  if (!v) return { ...EMPTY_DOC };
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return {
      desktop: typeof o.desktop === 'string' ? o.desktop : '',
      tablet: typeof o.tablet === 'string' ? o.tablet : '',
      mobile: typeof o.mobile === 'string' ? o.mobile : '',
    };
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('{')) {
      try {
        return parseDoc(JSON.parse(s));
      } catch {
        /* not JSON — fall through to legacy */
      }
    }
    return { desktop: v, tablet: '', mobile: '' };
  }
  return { ...EMPTY_DOC };
};

const isEmptyDoc = (d: DeviceDoc) => !d.desktop && !d.tablet && !d.mobile;

const backendURL = (typeof window !== 'undefined' && (window as any).strapi?.backendURL) || '';
const toAbsolute = (url: string) => (/^https?:\/\//.test(url) || url.startsWith('data:') ? url : `${backendURL}${url}`);

/* ------------------------------ inline icons ------------------------------ */
const svgProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const AlignLeftIcon = () => <svg {...svgProps}><path d="M4 6h16M4 12h10M4 18h13" /></svg>;
const AlignCenterIcon = () => <svg {...svgProps}><path d="M4 6h16M7 12h10M5 18h14" /></svg>;
const AlignRightIcon = () => <svg {...svgProps}><path d="M4 6h16M10 12h10M7 18h13" /></svg>;
const AlignJustifyIcon = () => <svg {...svgProps}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
const EraserIcon = () => <svg {...svgProps}><path d="M8 20H21" /><path d="M5.5 13.5l5-5 6 6-4 4H9z" /></svg>;
const DesktopIcon = () => <svg {...svgProps}><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></svg>;
const TabletIcon = () => <svg {...svgProps}><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M11 18h2" /></svg>;
const MobileIcon = () => <svg {...svgProps}><rect x="8" y="3" width="8" height="18" rx="2" /><path d="M11 18h2" /></svg>;

/* ----------------------------- styled elements ---------------------------- */
const FieldRoot = styled(Field.Root)`
  width: 100%;
`;

const Container = styled.div`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.tableShadow};
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
  background: ${({ theme }) => theme.colors.neutral0};
  position: sticky;
  top: 0;
  z-index: 2;
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.neutral100};
`;

const Spacer = styled.div`
  flex: 1 1 auto;
`;

const TBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border: none;
  border-radius: 6px;
  background: ${({ theme, $active }) => ($active ? theme.colors.primary600 : 'transparent')};
  color: ${({ theme, $active }) => ($active ? theme.colors.neutral0 : theme.colors.neutral700)};
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;

  svg { width: 16px; height: 16px; fill: currentColor; }
  svg[stroke] { fill: none; stroke: currentColor; }

  &:hover:not(:disabled) {
    background: ${({ theme, $active }) => ($active ? theme.colors.primary600 : theme.colors.neutral200)};
    color: ${({ theme, $active }) => ($active ? theme.colors.neutral0 : theme.colors.neutral800)};
  }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

const TSelect = styled.select`
  height: 30px;
  max-width: 130px;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};
  font-size: 12px;
  font-weight: 500;
  padding: 0 6px;
  cursor: pointer;

  &:hover { border-color: ${({ theme }) => theme.colors.neutral300}; }
  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.primary600}; }
`;

const ColorLabel = styled.label<{ $bar: string }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  border-radius: 6px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.neutral700};
  font-size: 13px;
  font-weight: 700;

  &:hover { background: ${({ theme }) => theme.colors.neutral200}; }
  &::after {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 4px;
    height: 3px;
    border-radius: 2px;
    background: ${({ $bar }) => $bar};
  }
  input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
`;

const Dropdown = styled.div`
  position: relative;
  display: inline-flex;
`;

const Menu = styled.div`
  position: absolute;
  top: 34px;
  left: 0;
  z-index: 10;
  min-width: 190px;
  padding: 4px;
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.popupShadow};
`;

const MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${({ theme }) => theme.colors.neutral800};
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  svg { width: 16px; height: 16px; fill: currentColor; }
  svg[stroke] { fill: none; stroke: currentColor; }
  &:hover { background: ${({ theme }) => theme.colors.neutral100}; }
`;

const Stage = styled.div<{ $framed: boolean }>`
  display: flex;
  justify-content: center;
  background: ${({ theme, $framed }) => ($framed ? theme.colors.neutral100 : theme.colors.neutral0)};
  padding: ${({ $framed }) => ($framed ? '16px' : '0')};
`;

const DeviceFrame = styled.div<{ $width: string; $framed: boolean }>`
  width: ${({ $width }) => $width};
  max-width: 100%;
  background: ${({ theme }) => theme.colors.neutral0};
  border: ${({ theme, $framed }) => ($framed ? `1px solid ${theme.colors.neutral200}` : 'none')};
  border-radius: ${({ $framed }) => ($framed ? '8px' : '0')};
  transition: width 0.2s ease;
`;

const EditorArea = styled.div`
  .ProseMirror { min-height: 280px; padding: 16px 20px; outline: none; }
  .ProseMirror > * + * { margin-top: 0.6em; }
  .ProseMirror p { margin: 0; }
  .ProseMirror h1 { font-size: 2rem; font-weight: 700; }
  .ProseMirror h2 { font-size: 1.6rem; font-weight: 700; }
  .ProseMirror h3 { font-size: 1.3rem; font-weight: 700; }
  .ProseMirror h4 { font-size: 1.1rem; font-weight: 700; }
  .ProseMirror h5, .ProseMirror h6 { font-size: 1rem; font-weight: 700; }
  .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; }
  .ProseMirror ul { list-style: disc; }
  .ProseMirror ol { list-style: decimal; }
  .ProseMirror a { color: ${({ theme }) => theme.colors.primary600}; text-decoration: underline; }
  .ProseMirror blockquote {
    border-left: 3px solid ${({ theme }) => theme.colors.neutral300};
    padding-left: 1rem;
    color: ${({ theme }) => theme.colors.neutral600};
  }
  .ProseMirror pre {
    background: ${({ theme }) => theme.colors.neutral800};
    color: ${({ theme }) => theme.colors.neutral0};
    border-radius: 6px;
    padding: 10px 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    overflow-x: auto;
  }
  .ProseMirror code { background: ${({ theme }) => theme.colors.neutral150}; border-radius: 4px; padding: 0.1em 0.3em; font-size: 0.9em; }
  .ProseMirror pre code { background: none; padding: 0; }
  .ProseMirror hr { border: none; border-top: 2px solid ${({ theme }) => theme.colors.neutral200}; margin: 1rem 0; }
  .ProseMirror img { max-width: 100%; height: auto; border-radius: 6px; }
  .ProseMirror img.ProseMirror-selectednode { outline: 2px solid ${({ theme }) => theme.colors.primary600}; }
  .ProseMirror table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
  .ProseMirror th, .ProseMirror td { border: 1px solid ${({ theme }) => theme.colors.neutral300}; padding: 6px 10px; vertical-align: top; position: relative; }
  .ProseMirror th { background: ${({ theme }) => theme.colors.neutral100}; font-weight: 700; }
  .ProseMirror .selectedCell::after { content: ''; position: absolute; inset: 0; background: ${({ theme }) => theme.colors.primary100}; opacity: 0.4; pointer-events: none; }
  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: ${({ theme }) => theme.colors.neutral500};
    pointer-events: none;
    height: 0;
  }
`;

const SourceArea = styled.textarea`
  width: 100%;
  min-height: 280px;
  border: none;
  outline: none;
  resize: vertical;
  padding: 16px 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  background: ${({ theme }) => theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};
`;

const Footer = styled(Flex)`
  border-top: 1px solid ${({ theme }) => theme.colors.neutral150};
  background: ${({ theme }) => theme.colors.neutral100};
  color: ${({ theme }) => theme.colors.neutral600};
  font-size: 12px;
`;

/* --------------------------- image insert dropdown ------------------------ */
const ImageMenu = ({ active, onPickMedia, onPickUrl }: { active: boolean; onPickMedia: () => void; onPickUrl: () => void }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <Dropdown ref={ref}>
      <TBtn type="button" title="Chèn ảnh" $active={active} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>
        <ImageIcon />
      </TBtn>
      {open && (
        <Menu>
          <MenuItem
            type="button"
            onClick={() => {
              setOpen(false);
              onPickMedia();
            }}
          >
            <ImageIcon /> Từ Media Library
          </MenuItem>
          <MenuItem
            type="button"
            onClick={() => {
              setOpen(false);
              onPickUrl();
            }}
          >
            <LinkIcon /> Từ URL
          </MenuItem>
        </Menu>
      )}
    </Dropdown>
  );
};

/* -------------------------------- toolbar -------------------------------- */
const MenuBar = ({
  editor,
  source,
  onToggleSource,
  device,
  onDevice,
  onCopyFromDesktop,
  onOpenMedia,
  onOpenLink,
  onOpenImageUrl,
}: {
  editor: Editor | null;
  source: boolean;
  onToggleSource: () => void;
  device: Device;
  onDevice: (d: Device) => void;
  onCopyFromDesktop: () => void;
  onOpenMedia: () => void;
  onOpenLink: () => void;
  onOpenImageUrl: () => void;
}) => {
  if (!editor) return null;

  const can = editor.can();
  const headingValue = (() => {
    for (let level = 1; level <= 6; level += 1) {
      if (editor.isActive('heading', { level })) return `h${level}`;
    }
    return 'p';
  })();
  const fontSize = (editor.getAttributes('textStyle').fontSize as string) || '';
  const textColor = (editor.getAttributes('textStyle').color as string) || '#212134';
  const hlColor = (editor.getAttributes('highlight').color as string) || '#ffe21f';

  const btn = (icon: React.ReactNode, active: boolean, run: () => void, title: string, disabled = false) => (
    <TBtn type="button" title={title} $active={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {icon}
    </TBtn>
  );

  return (
    <Toolbar>
      {/* device preview */}
      <Box style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}>
        <Group>
          {btn(<DesktopIcon />, device === 'desktop', () => onDevice('desktop'), 'Soạn cho desktop')}
          {btn(<TabletIcon />, device === 'tablet', () => onDevice('tablet'), 'Soạn cho tablet')}
          {btn(<MobileIcon />, device === 'mobile', () => onDevice('mobile'), 'Soạn cho mobile')}
          {device !== 'desktop' &&
            btn(
              <svg {...svgProps}>
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>,
              false,
              onCopyFromDesktop,
              'Sao chép nội dung từ desktop'
            )}
        </Group>
      </Box>
      <Spacer />
      <Group>
        <TSelect
          title="Kiểu đoạn"
          value={headingValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
          }}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </TSelect>
        <TSelect
          title="Cỡ chữ"
          value={fontSize}
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().setFontSize(v).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
        >
          <option value="">Cỡ chữ</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s.replace('px', '')}
            </option>
          ))}
        </TSelect>
      </Group>

      <Group>
        {btn(<Bold />, editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Đậm')}
        {btn(<Italic />, editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Nghiêng')}
        {btn(<Underline />, editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Gạch chân')}
        {btn(<StrikeThrough />, editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Gạch ngang')}
        {btn(<span>x<sub>2</sub></span>, editor.isActive('subscript'), () => editor.chain().focus().toggleSubscript().run(), 'Chỉ số dưới')}
        {btn(<span>x<sup>2</sup></span>, editor.isActive('superscript'), () => editor.chain().focus().toggleSuperscript().run(), 'Chỉ số trên')}
      </Group>

      <Group>
        <ColorLabel title="Màu chữ" $bar={textColor}>
          A
          <input type="color" value={textColor} onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
        </ColorLabel>
        <ColorLabel title="Tô nền (highlight)" $bar={hlColor}>
          H
          <input type="color" value={hlColor} onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} />
        </ColorLabel>
      </Group>

      <Group>
        {btn(<AlignLeftIcon />, editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run(), 'Căn trái')}
        {btn(<AlignCenterIcon />, editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), 'Căn giữa')}
        {btn(<AlignRightIcon />, editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run(), 'Căn phải')}
        {btn(<AlignJustifyIcon />, editor.isActive({ textAlign: 'justify' }), () => editor.chain().focus().setTextAlign('justify').run(), 'Căn đều')}
      </Group>

      <Group>
        {btn(<BulletList />, editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Danh sách dấu chấm')}
        {btn(<NumberList />, editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Danh sách số')}
        {btn(<Quotes />, editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Trích dẫn')}
        {btn(<CodeBlock />, editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), 'Khối code')}
        {btn(<Minus />, false, () => editor.chain().focus().setHorizontalRule().run(), 'Đường kẻ ngang')}
      </Group>

      <Group>
        {btn(<LinkIcon />, editor.isActive('link'), onOpenLink, 'Chèn liên kết')}
        <ImageMenu active={false} onPickMedia={onOpenMedia} onPickUrl={onOpenImageUrl} />
        {btn(<GridNine />, editor.isActive('table'), () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), 'Chèn bảng 3×3')}
        {editor.isActive('table') && (
          <>
            {btn(<Plus />, false, () => editor.chain().focus().addColumnAfter().run(), 'Thêm cột')}
            {btn(<Plus />, false, () => editor.chain().focus().addRowAfter().run(), 'Thêm hàng')}
            {btn(<Trash />, false, () => editor.chain().focus().deleteTable().run(), 'Xoá bảng')}
          </>
        )}
      </Group>

      <Group>
        <TSelect
          title="Ký tự đặc biệt"
          value=""
          onChange={(e) => {
            if (e.target.value) editor.chain().focus().insertContent(e.target.value).run();
          }}
        >
          <option value="">Ω</option>
          {SPECIAL_CHARS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </TSelect>
        {btn(<EraserIcon />, false, () => editor.chain().focus().unsetAllMarks().clearNodes().run(), 'Xoá định dạng')}
        {btn(<Code />, source, onToggleSource, 'Xem/sửa HTML')}
      </Group>

      <Group>
        {btn(<ArrowsCounterClockwise />, false, () => editor.chain().focus().undo().run(), 'Hoàn tác', !can.undo())}
        {btn(<ArrowClockwise />, false, () => editor.chain().focus().redo().run(), 'Làm lại', !can.redo())}
      </Group>
    </Toolbar>
  );
};

/* --------------------------------- modals -------------------------------- */
const LinkModal = ({ editor, open, onClose }: { editor: Editor | null; open: boolean; onClose: () => void }) => {
  const [href, setHref] = React.useState('');
  const [text, setText] = React.useState('');
  const [newTab, setNewTab] = React.useState(true);
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    if (!open || !editor) return;
    const attrs = editor.getAttributes('link');
    const { from, to, empty } = editor.state.selection;
    setHref((attrs.href as string) || '');
    setText(empty ? '' : editor.state.doc.textBetween(from, to, ' '));
    setNewTab(attrs.target ? attrs.target === '_blank' : true);
    setEditing(Boolean(attrs.href));
  }, [open, editor]);

  if (!editor) return null;

  const apply = () => {
    const url = href.trim();
    if (!url) return;
    const attrs = { href: url, target: newTab ? '_blank' : null, rel: newTab ? 'noopener noreferrer' : null };
    const { from, to, empty } = editor.state.selection;
    const label = text.trim();
    const selected = empty ? '' : editor.state.doc.textBetween(from, to, ' ');
    if (empty || (label && label !== selected)) {
      editor.chain().focus().insertContent({ type: 'text', text: label || url, marks: [{ type: 'link', attrs }] }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink(attrs).run();
    }
    onClose();
  };
  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <Modal.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{editing ? 'Sửa liên kết' : 'Chèn liên kết'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root name="link-url" required>
              <Field.Label>Đường dẫn (URL)</Field.Label>
              <Field.Input placeholder="https://example.com" value={href} onChange={(e) => setHref(e.target.value)} />
            </Field.Root>
            <Field.Root name="link-text">
              <Field.Label>Văn bản hiển thị</Field.Label>
              <Field.Input placeholder="(tuỳ chọn — mặc định dùng URL)" value={text} onChange={(e) => setText(e.target.value)} />
            </Field.Root>
            <Checkbox checked={newTab} onCheckedChange={(c) => setNewTab(Boolean(c))}>
              Mở trong tab mới
            </Checkbox>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Huỷ</Button>
          </Modal.Close>
          <Flex gap={2}>
            {editing && (
              <Button variant="danger-light" onClick={remove}>
                Gỡ liên kết
              </Button>
            )}
            <Button onClick={apply} disabled={!href.trim()}>
              {editing ? 'Cập nhật' : 'Chèn'}
            </Button>
          </Flex>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

const ImageUrlModal = ({ editor, open, onClose }: { editor: Editor | null; open: boolean; onClose: () => void }) => {
  const [url, setUrl] = React.useState('');
  const [alt, setAlt] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setUrl('');
      setAlt('');
    }
  }, [open]);

  if (!editor) return null;

  const apply = () => {
    const src = url.trim();
    if (!src) return;
    editor.chain().focus().setImage({ src, alt: alt.trim() || undefined }).run();
    onClose();
  };

  return (
    <Modal.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Chèn ảnh từ URL</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root name="image-url" required>
              <Field.Label>URL ảnh</Field.Label>
              <Field.Input placeholder="https://…/anh.jpg" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field.Root>
            <Field.Root name="image-alt">
              <Field.Label>Văn bản thay thế (alt)</Field.Label>
              <Field.Input placeholder="(tuỳ chọn)" value={alt} onChange={(e) => setAlt(e.target.value)} />
            </Field.Root>
            {url.trim() && (
              <Box padding={2} background="neutral100" hasRadius>
                <img src={url} alt="preview" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 4, display: 'block', margin: '0 auto' }} />
              </Box>
            )}
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Huỷ</Button>
          </Modal.Close>
          <Button onClick={apply} disabled={!url.trim()}>
            Chèn
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

/* --------------------------------- input --------------------------------- */
const TiptapInput = React.forwardRef<HTMLDivElement, TiptapInputProps>((props, ref) => {
  const { name, value, onChange, intlLabel, labelAction, hint, required, error, disabled, attribute } = props;
  const { formatMessage } = useIntl();

  // Media Library dialog component registered by the upload plugin.
  const MediaLibraryDialog = useStrapiApp('TiptapInput', (state: any) => state.components['media-library']) as
    | React.ComponentType<{ allowedTypes?: string[]; multiple?: boolean; onClose: () => void; onSelectAssets: (assets: StrapiAsset[]) => void }>
    | undefined;

  const [source, setSource] = React.useState(false);
  const [sourceValue, setSourceValue] = React.useState('');
  const [device, setDevice] = React.useState<Device>('desktop');
  const [mediaOpen, setMediaOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [imageUrlOpen, setImageUrlOpen] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const fieldType = attribute?.type ?? 'json';

  // Per-device documents — the source of truth we serialize back to the field value.
  const docRef = React.useRef<DeviceDoc>(parseDoc(value));
  const deviceRef = React.useRef<Device>('desktop');

  // The content-manager lays fields out in a 12-col grid; custom fields (incl. those inside
  // Dynamic Zone components) default to a half-row cell. Walk up to the grid cell and make it
  // span the full row so the editor is truly full width.
  React.useEffect(() => {
    let node: HTMLElement | null = rootRef.current;
    for (let i = 0; i < 6 && node; i += 1) {
      const parent = node.parentElement;
      if (parent && getComputedStyle(parent).display.includes('grid')) {
        node.style.gridColumn = '1 / -1';
        node.style.width = '100%';
        node.style.maxWidth = '100%';
        return;
      }
      node = parent;
    }
  }, []);

  const emitDoc = React.useCallback(
    (doc: DeviceDoc) => {
      onChangeRef.current({ target: { name, type: fieldType, value: isEmptyDoc(doc) ? null : doc } });
    },
    [name, fieldType]
  );

  // Write the given HTML into the active device bucket and emit the whole document.
  const commitHTML = React.useCallback(
    (html: string) => {
      const next = { ...docRef.current, [deviceRef.current]: cleanHTML(html) };
      docRef.current = next;
      emitDoc(next);
    },
    [emitDoc]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: { openOnClick: false, autolink: true },
      }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: true } }),
      CharacterCount,
      Placeholder.configure({ placeholder: 'Nhập nội dung…' }),
    ],
    content: docRef.current.desktop || '',
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => commitHTML(editor.getHTML()),
  });

  React.useEffect(() => {
    if (!editor) return undefined;
    const update = () => forceUpdate();
    editor.on('transaction', update);
    return () => {
      editor.off('transaction', update);
    };
  }, [editor]);

  // External value changes (entry switch / form reset): reload docs + the active device's content.
  React.useEffect(() => {
    if (!editor || source) return;
    const incoming = parseDoc(value);
    docRef.current = incoming;
    const current = incoming[deviceRef.current] || '';
    if (current !== editor.getHTML()) {
      editor.commands.setContent(current, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  // Switch device: stash the current editor HTML into its bucket, then load the target device's HTML.
  const changeDevice = (d: Device) => {
    if (d === deviceRef.current) return;
    if (editor && !source) {
      docRef.current = { ...docRef.current, [deviceRef.current]: cleanHTML(editor.getHTML()) };
      deviceRef.current = d;
      editor.commands.setContent(docRef.current[d] || '', { emitUpdate: false });
    } else {
      deviceRef.current = d;
    }
    setDevice(d);
  };

  // Convenience: copy the desktop content into the current (tablet/mobile) device as a starting point.
  const copyFromDesktop = () => {
    if (!editor || deviceRef.current === 'desktop') return;
    const html = docRef.current.desktop || '';
    editor.commands.setContent(html, { emitUpdate: false });
    commitHTML(html);
    forceUpdate();
  };

  const toggleSource = () => {
    if (!editor) return;
    if (!source) {
      setSourceValue(editor.getHTML());
      setSource(true);
    } else {
      editor.commands.setContent(sourceValue || '', { emitUpdate: false });
      commitHTML(sourceValue || '');
      setSource(false);
    }
  };

  const handleSelectAssets = (assets: StrapiAsset[]) => {
    const images = (assets || []).filter((a) => !a.mime || a.mime.startsWith('image/'));
    if (editor && images.length) {
      let chain = editor.chain().focus();
      images.forEach((a) => {
        chain = chain.setImage({ src: toAbsolute(a.url), alt: a.alternativeText || a.name || '' });
      });
      chain.run();
    }
    setMediaOpen(false);
  };

  const characters = editor?.storage?.characterCount?.characters?.() ?? 0;
  const words = editor?.storage?.characterCount?.words?.() ?? 0;
  const framed = device !== 'desktop';

  return (
    <FieldRoot ref={rootRef} name={name} id={name} error={error} hint={hint} required={required}>
      <Field.Label action={labelAction}>{intlLabel ? formatMessage(intlLabel) : name}</Field.Label>
      <Container ref={ref}>
        <MenuBar
          editor={editor}
          source={source}
          onToggleSource={toggleSource}
          device={device}
          onDevice={changeDevice}
          onCopyFromDesktop={copyFromDesktop}
          onOpenMedia={() => setMediaOpen(true)}
          onOpenLink={() => setLinkOpen(true)}
          onOpenImageUrl={() => setImageUrlOpen(true)}
        />
        {source ? (
          <SourceArea
            value={sourceValue}
            disabled={disabled}
            onChange={(e) => {
              setSourceValue(e.target.value);
              commitHTML(e.target.value);
            }}
          />
        ) : (
          <Stage $framed={framed}>
            <DeviceFrame $width={DEVICE_WIDTH[device]} $framed={framed}>
              <EditorArea>
                <EditorContent editor={editor} />
              </EditorArea>
            </DeviceFrame>
          </Stage>
        )}
        <Footer justifyContent="flex-end" gap={4} paddingTop={1} paddingBottom={1} paddingRight={3}>
          <span>words: {words}</span>
          <span>characters: {characters}</span>
        </Footer>
      </Container>
      <Field.Error />
      <Field.Hint />

      {mediaOpen && MediaLibraryDialog && (
        <MediaLibraryDialog allowedTypes={['images']} multiple onClose={() => setMediaOpen(false)} onSelectAssets={handleSelectAssets} />
      )}

      <LinkModal editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} />
      <ImageUrlModal editor={editor} open={imageUrlOpen} onClose={() => setImageUrlOpen(false)} />
    </FieldRoot>
  );
});

export default TiptapInput;
