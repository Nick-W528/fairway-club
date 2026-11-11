import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Txt } from '@/components/ui';
import { parseMemberCode } from '@/lib/member-code';
import { radius, space, useColors } from '@/theme';

/** Full-screen camera that reads a member's bar-card QR code. Native only. */
export function MemberScanner({
  visible,
  clubId,
  onClose,
  onScanned,
  onInvalid,
}: {
  visible: boolean;
  clubId: string;
  onClose: () => void;
  onScanned: (userId: string) => void;
  onInvalid: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => {
        handled.current = false;
      }}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;
              handled.current = true;
              const parsed = parseMemberCode(data);
              if (parsed && parsed.clubId === clubId) onScanned(parsed.userId);
              else onInvalid();
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg }}>
            <Txt color="#fff" style={{ textAlign: 'center' }}>
              Allow camera access to scan members' bar cards.
            </Txt>
            <Button title="Allow camera" variant="accent" onPress={requestPermission} />
          </View>
        )}
        {permission?.granted && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 240, height: 240, borderRadius: radius.lg, borderWidth: 3, borderColor: c.accent }} />
            <Txt color="#fff" style={{ marginTop: space.lg }}>
              Point at the member's QR code
            </Txt>
          </View>
        )}
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close scanner"
          style={{ position: 'absolute', top: insets.top + space.md, right: space.lg, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 22, padding: 8 }}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
