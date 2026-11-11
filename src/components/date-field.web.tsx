import { View } from 'react-native';

import type { DateFieldProps } from '@/components/date-field';
import { Txt } from '@/components/ui';
import { fonts, radius, useColors, useTheme } from '@/theme';

/** Web: the browser's own date/time pickers. */
export function DateField({ label, mode, value, onChange }: DateFieldProps) {
  const c = useColors();
  const { mode: scheme } = useTheme();
  const type = mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'datetime-local';
  const htmlValue = mode === 'datetime' ? value.replace(' ', 'T') : value;
  return (
    <View style={{ gap: 6 }}>
      {label && <Txt variant="label">{label}</Txt>}
      <input
        type={type}
        value={htmlValue}
        onChange={(e) => onChange(mode === 'datetime' ? e.target.value.replace('T', ' ').slice(0, 16) : e.target.value.slice(0, mode === 'time' ? 5 : 10))}
        style={{
          fontFamily: fonts.body,
          fontSize: 15,
          padding: '11px 12px',
          borderRadius: radius.sm,
          border: `1px solid ${c.border}`,
          background: c.surface,
          color: c.text,
          colorScheme: scheme,
        }}
      />
    </View>
  );
}
