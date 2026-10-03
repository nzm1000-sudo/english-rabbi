import type { KidTopic } from '@/domain/kids/schema';

/**
 * Topic names (spoken and shown) and an emoji used only when
 * the topic has no 3D picture (see TOPIC_PICTURES in domain/kids/pictures).
 */
export const TOPIC_INFO: Record<KidTopic, { he: string; emoji: string }> = {
  colors: { he: 'צבעים', emoji: '🎨' },
  numbers: { he: 'מספרים', emoji: '🔢' },
  animals: { he: 'בעלי חיים', emoji: '🦁' },
  food: { he: 'אוכל', emoji: '🍎' },
  body: { he: 'הגוף שלי', emoji: '👋' },
  family: { he: 'משפחה', emoji: '👨‍👩‍👧' },
  home: { he: 'בבית', emoji: '🏠' },
  clothes: { he: 'בגדים', emoji: '👕' },
  nature: { he: 'טבע', emoji: '🌳' },
  shabbat: { he: 'שבת', emoji: '🕯️' },
  holidays: { he: 'חגים', emoji: '🕎' },
  toys: { he: 'צעצועים', emoji: '🧸' },
  actions: { he: 'עושים', emoji: '🏃' },
  feelings: { he: 'רגשות', emoji: '😊' },
};
