window.ACME_UTILS = {
    formatCOP(value) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    },
    resolveImageUrl(img, apiBaseUrl) {
        if (!img) return '';
        if (/^https?:\/\//i.test(img)) return img;
        if (img.startsWith('/')) return `${apiBaseUrl}${img}`;
        return `${apiBaseUrl}/${img}`;
    }
};
