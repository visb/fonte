import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onDocuments: () => void;
  accentColor: string;
}

function MenuRow({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: `${color}20`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon as never} size={22} color={color} />
      </View>
      <Text style={{ fontSize: 16, color: '#111827' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AttachmentMenu({ visible, onClose, onCamera, onGallery, onDocuments, accentColor }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      </Pressable>
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>Enviar</Text>
        <MenuRow icon="camera-outline" label="Câmera" color={accentColor} onPress={onCamera} />
        <MenuRow icon="images-outline" label="Galeria" color={accentColor} onPress={onGallery} />
        <MenuRow icon="document-outline" label="Documento" color={accentColor} onPress={onDocuments} />
        <TouchableOpacity
          onPress={onClose}
          style={{ marginTop: 8, alignItems: 'center', paddingVertical: 12 }}
        >
          <Text style={{ color: '#6b7280', fontSize: 15 }}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
