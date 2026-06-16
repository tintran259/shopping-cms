import type { Schema, Struct } from '@strapi/strapi';

export interface BlocksBanner extends Struct.ComponentSchema {
  collectionName: 'components_blocks_banners';
  info: {
    displayName: 'Banner';
  };
  attributes: {
    banner: Schema.Attribute.Relation<'oneToOne', 'api::banner.banner'>;
  };
}

export interface BlocksCarousel extends Struct.ComponentSchema {
  collectionName: 'components_blocks_carousels';
  info: {
    displayName: 'Carousel';
    icon: 'monitor';
  };
  attributes: {
    autoplay: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    endAt: Schema.Attribute.DateTime;
    height: Schema.Attribute.String & Schema.Attribute.DefaultTo<'auto'>;
    interval: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<5000>;
    loop: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    slides: Schema.Attribute.Component<'blocks.slide', true>;
    startAt: Schema.Attribute.DateTime;
    width: Schema.Attribute.String & Schema.Attribute.DefaultTo<'100%'>;
  };
}

export interface BlocksContentGrid extends Struct.ComponentSchema {
  collectionName: 'components_blocks_content_grids';
  info: {
    displayName: 'Content grid';
    icon: 'apps';
  };
  attributes: {
    desktopColumns: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 12;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<3>;
    endAt: Schema.Attribute.DateTime;
    items: Schema.Attribute.Relation<'oneToMany', 'api::grid-card.grid-card'>;
    mobileColumns: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 12;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    startAt: Schema.Attribute.DateTime;
    tabletColumns: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 12;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<2>;
  };
}

export interface BlocksImage extends Struct.ComponentSchema {
  collectionName: 'components_image_images';
  info: {
    displayName: 'Image';
    icon: 'chartBubble';
  };
  attributes: {
    endAt: Schema.Attribute.DateTime;
    image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'> &
      Schema.Attribute.Required;
    startAt: Schema.Attribute.DateTime;
    target: Schema.Attribute.Enumeration<
      ['_blank', '_top', '_self', '_parent']
    >;
    url: Schema.Attribute.String;
  };
}

export interface BlocksRichText extends Struct.ComponentSchema {
  collectionName: 'components_richtext_rich_texts';
  info: {
    displayName: 'RichText';
    icon: 'discuss';
  };
  attributes: {
    content: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<'global::tiptap'>;
    endAt: Schema.Attribute.DateTime;
    startAt: Schema.Attribute.DateTime;
  };
}

export interface BlocksSlide extends Struct.ComponentSchema {
  collectionName: 'components_blocks_slides';
  info: {
    displayName: 'Slide';
    icon: 'picture';
  };
  attributes: {
    caption: Schema.Attribute.String;
    endAt: Schema.Attribute.DateTime;
    image: Schema.Attribute.Media<'images' | 'videos'> &
      Schema.Attribute.Required;
    objectFit: Schema.Attribute.Enumeration<
      ['cover', 'contain', 'fill', 'none', 'scale-down']
    > &
      Schema.Attribute.DefaultTo<'cover'>;
    startAt: Schema.Attribute.DateTime;
    target: Schema.Attribute.Enumeration<
      ['_blank', '_self', '_top', '_parent']
    >;
    url: Schema.Attribute.String;
  };
}

export interface NavLink extends Struct.ComponentSchema {
  collectionName: 'components_nav_links';
  info: {
    displayName: 'Link';
    icon: 'link';
  };
  attributes: {
    endAt: Schema.Attribute.DateTime;
    highlight: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    page: Schema.Attribute.Relation<
      'oneToOne',
      'api::landing-page.landing-page'
    >;
    startAt: Schema.Attribute.DateTime;
    url: Schema.Attribute.String;
  };
}

export interface NavMenuItem extends Struct.ComponentSchema {
  collectionName: 'components_nav_menu_items';
  info: {
    displayName: 'Menu item';
    icon: 'apps';
  };
  attributes: {
    children: Schema.Attribute.Component<'nav.submenu-item', true>;
    endAt: Schema.Attribute.DateTime;
    featuredBanner: Schema.Attribute.Relation<'oneToOne', 'api::banner.banner'>;
    highlight: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    icon: Schema.Attribute.String;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    page: Schema.Attribute.Relation<
      'oneToOne',
      'api::landing-page.landing-page'
    >;
    startAt: Schema.Attribute.DateTime;
    url: Schema.Attribute.String;
  };
}

export interface NavSubmenuItem extends Struct.ComponentSchema {
  collectionName: 'components_nav_submenu_items';
  info: {
    displayName: 'Submenu item';
    icon: 'bulletList';
  };
  attributes: {
    children: Schema.Attribute.Component<'nav.link', true>;
    endAt: Schema.Attribute.DateTime;
    highlight: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    page: Schema.Attribute.Relation<
      'oneToOne',
      'api::landing-page.landing-page'
    >;
    startAt: Schema.Attribute.DateTime;
    url: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'blocks.banner': BlocksBanner;
      'blocks.carousel': BlocksCarousel;
      'blocks.content-grid': BlocksContentGrid;
      'blocks.image': BlocksImage;
      'blocks.rich-text': BlocksRichText;
      'blocks.slide': BlocksSlide;
      'nav.link': NavLink;
      'nav.menu-item': NavMenuItem;
      'nav.submenu-item': NavSubmenuItem;
    }
  }
}
