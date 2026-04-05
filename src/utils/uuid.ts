export const generateId = (): string => {
  // React Native compatible UUID v4 generator
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // UUID version 4
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8]; // variant bits
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }
  return uuid;
};
