import type { KidTopic } from '@/domain/kids/schema';

export const TOPIC_INFO: Record<KidTopic, { he: string; emoji: string; hue: number }> = {
  colors: { he: 'צבעים', emoji: '🎨', hue: 330 },
  numbers: { he: 'מספרים', emoji: '🔢', hue: 210 },
  animals: { he: 'בעלי חיים', emoji: '🦁', hue: 35 },
  food: { he: 'אוכל', emoji: '🍎', hue: 0 },
  body: { he: 'הגוף שלי', emoji: '👋', hue: 20 },
  family: { he: 'משפחה', emoji: '👨‍👩‍👧', hue: 280 },
  home: { he: 'בבית', emoji: '🏠', hue: 25 },
  clothes: { he: 'בגדים', emoji: '👕', hue: 200 },
  nature: { he: 'טבע', emoji: '🌳', hue: 120 },
  shabbat: { he: 'שבת', emoji: '🕯️', hue: 45 },
  holidays: { he: 'חגים', emoji: '🕎', hue: 220 },
  toys: { he: 'צעצועים', emoji: '🧸', hue: 15 },
  actions: { he: 'עושים', emoji: '🏃', hue: 160 },
  feelings: { he: 'רגשות', emoji: '😊', hue: 50 },
};
