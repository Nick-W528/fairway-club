import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';

import { Row, Txt } from '@/components/ui';
import { fromValue, toValue, type DateFieldMode } from '@/lib/date-field-value';
import { fonts, radius, space, useColors } from '@/theme';

export interface DateFieldProps {
  label?: string;
  mode: DateFieldMode;
  /** 'YYYY-MM-DD', 'HH:MM' or 'YYYY-MM-DD HH:MM'; '' = empty */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
}

/** Native date/time picker (iOS compact picker, Android dialog). Web version: date-field.web.tsx */
export function DateField({ label, mode, value, onChange, placeholder = 'Not set', clearable }: DateFieldProps) {
  const c = useColors();
  const date = fromValue(value, mode);

  const openAndroid = () => {
    const pick = (m: 'date' | 'time', start: Date, then: (d: Date) => void) =>
      DateTimePickerAndroid.open({
        value: start,
        mode: m,
        is24Hour: true,
        onChange: (e, d) => {
          if (e.type === 'set' && d) then(d);
        },
      });
    if (mode === 'datetime') pick('date', date, (d) => pick('time', d, (t) => onChange(toValue(t, mode))));
    else pick(mode, date, (d) => onChange(toValue(d, mode)));
  };

  return (
    <View style={{ gap: 6 }}>
      {label && <Txt variant="label">{label}</Txt>}
      <Row>
        {Platform.OS === 'ios' && (value || !clearable) ? (
          <DateTimePicker
            value={date}
            mode={mode}
            display="compact"
            accentColor={c.accentText}
            onChange={(_, d) => d && onChange(toValue(d, mode))}
            style={{ alignSelf: 'flex-start' }}
          />
        ) : (
          <Pressable
            onPress={Platform.OS === 'ios' ? () => onChange(toValue(new Date(), mode)) : openAndroid}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              borderRadius: radius.sm,
              paddingHorizontal: space.md,
              paddingVertical: 12,
            }}>
            <Ionicons name={mode === 'time' ? 'time-outline' : 'calendar-outline'} size={18} color={c.textMuted} />
            <Txt style={{ fontFamily: fonts.medium }} color={value ? c.text : c.textMuted}>
              {value || placeholder}
            </Txt>
          </Pressable>
        )}
        {clearable && !!value && (
          <Pressable onPress={() => onChange('')} accessibilityLabel="Clear" hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={c.textMuted} />
          </Pressable>
        )}
      </Row>
    </View>
  );
}
