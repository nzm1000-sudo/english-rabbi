import type { Domain } from '@/domain/skills/taxonomy';
import { GrammarIcon, ListenIcon, ReadingIcon, SpeakIcon, VocabIcon, WriteIcon } from './icons';

export function DomainIcon({ domain, size = 24 }: { domain: Domain; size?: number }) {
  switch (domain) {
    case 'vocabulary':
      return <VocabIcon size={size} />;
    case 'grammar':
      return <GrammarIcon size={size} />;
    case 'reading':
      return <ReadingIcon size={size} />;
    case 'listening':
      return <ListenIcon size={size} />;
    case 'writing':
      return <WriteIcon size={size} />;
    case 'speaking':
      return <SpeakIcon size={size} />;
  }
}
