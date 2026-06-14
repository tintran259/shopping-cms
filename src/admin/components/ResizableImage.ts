import Image from '@tiptap/extension-image';

/**
 * Image extension with drag-to-resize and left/center/right alignment.
 *
 * Stored attributes (all serialized onto the `<img>` so the storefront can use them directly):
 *   - `width`  → HTML `width="N"` attribute + inline `style="width:Npx"`
 *   - `height` → HTML `height="N"` attribute + inline `style="height:auto"`
 *   - `align`  → `data-align` + inline `margin` (auto on the appropriate side)
 *
 * width/height are emitted as real HTML attributes (intrinsic pixel size, correct aspect
 * ratio) so a storefront can feed them straight into `next/image` and browsers can reserve
 * space (no layout shift). The CSS keeps `max-width:100%; height:auto` so it still scales.
 *
 * The node view is plain DOM (no React) on purpose: a React node view would re-enter
 * Strapi's React context and risk the duplicate-React `useContext` crash this editor avoids.
 */
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const alignStyle = (align: unknown): string => {
  switch (align) {
    case 'center':
      return 'display:block;margin-left:auto;margin-right:auto;';
    case 'right':
      return 'display:block;margin-left:auto;margin-right:0;';
    case 'left':
      return 'display:block;margin-right:auto;margin-left:0;';
    default:
      return '';
  }
};

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => toNum(el.getAttribute('width')) ?? toNum(el.style.width),
        renderHTML: (attrs) => {
          const w = toNum(attrs.width);
          if (!w) return {};
          return { width: w, style: `width: ${w}px;` };
        },
      },
      height: {
        default: null,
        parseHTML: (el) => toNum(el.getAttribute('height')) ?? toNum(el.style.height),
        renderHTML: (attrs) => {
          const h = toNum(attrs.height);
          if (!h) return {};
          // Real intrinsic height for aspect-ratio, but display stays auto so it scales.
          return { height: h, style: 'height: auto;' };
        },
      },
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-align') || null,
        renderHTML: (attrs) => {
          if (!attrs.align) return {};
          return { 'data-align': attrs.align, style: alignStyle(attrs.align) };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node;

      // Outer block container: positions the image left/center/right.
      const container = document.createElement('div');
      // Inner wrapper: shrink-wraps image + handle so the handle hugs the image edge.
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;display:inline-block;line-height:0;max-width:100%;';
      container.appendChild(wrapper);

      const img = document.createElement('img');
      wrapper.appendChild(img);

      const apply = (n: typeof node) => {
        img.src = n.attrs.src;
        img.alt = n.attrs.alt || '';
        if (n.attrs.title) img.title = n.attrs.title;
        img.style.cssText = 'max-width:100%;height:auto;display:block;';
        const w = toNum(n.attrs.width);
        if (w) img.style.width = `${w}px`;
        container.style.textAlign =
          n.attrs.align === 'center' ? 'center' : n.attrs.align === 'right' ? 'right' : 'left';
      };
      apply(currentNode);

      const sync = (updated: typeof node) => {
        if (updated.type.name !== currentNode.type.name) return false;
        currentNode = updated;
        apply(updated);
        return true;
      };

      if (!editor.isEditable) {
        return { dom: container, update: sync, ignoreMutation: () => true };
      }

      const handle = document.createElement('div');
      handle.style.cssText =
        'position:absolute;right:-6px;bottom:-6px;width:14px;height:14px;border:2px solid #4945ff;' +
        'background:#fff;border-radius:50%;cursor:nwse-resize;display:none;box-shadow:0 0 0 1px rgba(0,0,0,.12);z-index:2;';
      wrapper.appendChild(handle);

      let resizing = false;
      const show = () => {
        handle.style.display = 'block';
      };
      const hide = () => {
        if (!resizing) handle.style.display = 'none';
      };
      wrapper.addEventListener('mouseenter', show);
      wrapper.addEventListener('mouseleave', hide);

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        const startX = e.clientX;
        const startWidth = img.offsetWidth;
        // Natural aspect ratio, so height tracks the resized width.
        const ratio =
          img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;

        const onMove = (ev: MouseEvent) => {
          const next = Math.max(40, startWidth + (ev.clientX - startX));
          img.style.width = `${next}px`;
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          resizing = false;
          hide();
          if (typeof getPos === 'function') {
            const pos = getPos();
            if (typeof pos === 'number') {
              const width = Math.round(img.offsetWidth);
              const height = ratio ? Math.round(width / ratio) : currentNode.attrs.height;
              editor.view.dispatch(
                editor.view.state.tr.setNodeMarkup(pos, undefined, {
                  ...currentNode.attrs,
                  width,
                  height,
                })
              );
            }
          }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      // On decode, backfill any missing size from the image's natural dimensions so
      // width AND height are always present for the storefront — this also "converts"
      // older images that were saved with width only (height was `auto`).
      img.addEventListener('load', () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        if (typeof getPos !== 'function') return;

        const haveW = toNum(currentNode.attrs.width);
        const haveH = toNum(currentNode.attrs.height);
        if (haveW && haveH) return; // already complete

        const ratio = img.naturalWidth / img.naturalHeight;
        const width = haveW ?? img.naturalWidth;
        const height = haveH ?? Math.round(width / ratio);
        if (width === haveW && height === haveH) return;

        const pos = getPos();
        if (typeof pos !== 'number') return;
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(pos, undefined, {
            ...currentNode.attrs,
            width,
            height,
          })
        );
      });

      return {
        dom: container,
        update: sync,
        selectNode: () => {
          wrapper.style.outline = '2px solid #4945ff';
          show();
        },
        deselectNode: () => {
          wrapper.style.outline = '';
          hide();
        },
        ignoreMutation: () => true,
      };
    };
  },
});

export default ResizableImage;
