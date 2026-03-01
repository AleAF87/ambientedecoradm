// Configuração do Cloudinary
// Substitua os valores abaixo com suas credenciais do Cloudinary

const cloudinaryConfig = {
    cloudName: 'dhtdnsxpx', // Ex: 'demo123'
    uploadPreset: 'anexos_orcamentos', // Criar no Cloudinary Dashboard
    apiKey: '661525988294927', // Opcional, apenas para uploads server-side
    apiSecret: '6hpyXtgRZJWFL_gjxfgfLgHQpbE', // Opcional, apenas para uploads server-side
    folder: 'anexos', // Pasta onde as imagens serão salvas
};

// Função para upload de imagens
export async function uploadImagemCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', cloudinaryConfig.folder);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erro no upload da imagem');
        }

        const data = await response.json();
        return {
            url: data.secure_url,
            publicId: data.public_id,
            width: data.width,
            height: data.height,
            format: data.format
        };
    } catch (error) {
        console.error('Erro no upload para Cloudinary:', error);
        throw error;
    }
}

// Função para deletar imagem (opcional)
export async function deletarImagemCloudinary(publicId) {
    // Nota: Deleção normalmente requer API Key e Secret no backend
    // Esta função deve ser implementada no servidor
    console.warn('Deleção de imagens deve ser feita no backend');
    return false;
}

// Função para obter URL otimizada
export function getOtimizedImageUrl(publicId, options = {}) {
    const { width, height, crop = 'fill', quality = 'auto' } = options;
    let url = `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/`;
    
    if (width || height) {
        url += 'c_' + crop + ',';
        if (width) url += 'w_' + width + ',';
        if (height) url += 'h_' + height + ',';
    }
    
    url += 'q_' + quality + '/';
    url += 'v1/' + publicId;
    
    return url;
}

export default cloudinaryConfig;