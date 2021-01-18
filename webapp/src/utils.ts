let idCounter = 0;

// uniqueId generates a unique id with an optional prefix.
export const uniqueId = (prefix = '') => prefix + String(++idCounter);
