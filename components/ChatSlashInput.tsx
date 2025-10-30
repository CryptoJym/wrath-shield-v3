"use client";
import { useCallback, useState } from 'react';
import { defaultRegistry } from '@/lib/slashCommands';

export interface ChatSlashInputProps {
  placeholder?: string;
  onCommandOutput?: (text: string) => void;
}

export default function ChatSlashInput({ placeholder = 'Type a message…', onCommandOutput }: ChatSlashInputProps) {
  const [value, setValue] = useState('');
  const reg = defaultRegistry();

  const onKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (value.trim().startsWith('/')) {
        e.preventDefault();
        const out = await reg.run(value);
        if (typeof out === 'string') {
          onCommandOutput?.(out);
        }
        setValue('');
      }
    }
  }, [value, reg, onCommandOutput]);

  return (
    <textarea
      aria-label="Chat input"
      className="input w-full h-20"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}
