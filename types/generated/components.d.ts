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

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'blocks.banner': BlocksBanner;
      'blocks.image': BlocksImage;
      'blocks.rich-text': BlocksRichText;
    }
  }
}
