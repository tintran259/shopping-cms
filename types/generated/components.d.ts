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
    startAt: Schema.Attribute.DateTime;
    target: Schema.Attribute.Enumeration<
      ['_blank', '_self', '_top', '_parent']
    >;
    url: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'blocks.banner': BlocksBanner;
      'blocks.carousel': BlocksCarousel;
      'blocks.image': BlocksImage;
      'blocks.rich-text': BlocksRichText;
      'blocks.slide': BlocksSlide;
    }
  }
}
