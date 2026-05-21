import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#272950';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onDocument: () => void;
}

export function AttachmentMenuSheet({ visible, onClose, onCamera, onGallery, onDocument }: Props) {
  const items = [
    { icon: 'camera-outline', label: 'Câmera', onPress: onCamera },
    { icon: 'images-outline', label: 'Galeria', onPress: onGallery },
    { icon: 'document-outline', label: 'Documento', onPress: onDocument },
  ] as const;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      </Pressable>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 }}>Enviar</Text>
        {items.map(({ icon, label, onPress }) => (
          <TouchableOpacity key={label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={icon as never} size={22} color={ACCENT} />
            </View>
            <Text style={{ fontSize: 16, color: '#111827' }}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onClose} style={{ marginTop: 8, alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ color: '#6b7280', fontSize: 15 }}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
