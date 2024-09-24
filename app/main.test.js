import { decodeBencode } from './main'; // Adjust the import based on your actual file structure

describe('decodeBencode', () => {
  // ... existing test cases ...

  // New test cases
  describe('Numbers', () => {
    it('should decode positive integers', () => {
      expect(decodeBencode('i42e')).toBe(42);
    });

    it('should decode negative integers', () => {
      expect(decodeBencode('i-42e')).toBe(-42);
    });

    it('should decode zero', () => {
      expect(decodeBencode('i0e')).toBe(0);
    });
  });

  describe('Strings', () => {
    it('should decode simple strings', () => {
      expect(decodeBencode('4:spam')).toBe('spam');
    });

    it('should decode empty strings', () => {
      expect(decodeBencode('0:')).toBe('');
    });

    it('should decode strings with special characters', () => {
      expect(decodeBencode('11:hello world')).toBe('hello world');
    });
  });

  describe('Lists', () => {
    it('should decode simple lists', () => {
      expect(decodeBencode('l4:spam4:eggse')).toEqual(['spam', 'eggs']);
    });

    it('should decode nested lists', () => {
      expect(decodeBencode('ll4:spamee')).toEqual([['spam']]);
    });

    it('should decode lists with mixed types', () => {
      expect(decodeBencode('li42e4:spame')).toEqual([42, 'spam']);
    });
  });

  describe('Dictionaries', () => {
    it('should decode simple dictionaries', () => {
      expect(decodeBencode('d3:cow3:moo4:spam4:eggse')).toEqual({cow: 'moo', spam: 'eggs'});
    });

    it('should decode nested dictionaries', () => {
      expect(decodeBencode('d3:food3:bar3:bazee')).toEqual({foo: {bar: 'baz'}});
    });

    it('should decode dictionaries with mixed types', () => {
      expect(decodeBencode('d3:inti42e4:listl1:a1:bee')).toEqual({int: 42, list: ['a', 'b']});
    });
  });

  describe('Torrent file structure', () => {
    it('should decode a simplified torrent file structure', () => {
      const bencodedTorrent = 'd8:announce35:http://tracker.example.com/announce13:creation datei1609459200e4:infod6:lengthi1024e4:name8:file.txt12:piece lengthi16384eee';
      const decoded = decodeBencode(bencodedTorrent);

      expect(decoded).toEqual({
        announce: 'http://tracker.example.com/announce',
        'creation date': 1609459200,
        info: {
          length: 1024,
          name: 'file.txt',
          'piece length': 16384
        }
      });

      if (typeof decoded === 'object' && decoded !== null && 'info' in decoded) {
        expect(decoded.info).toHaveProperty('name', 'file.txt');
        expect(decoded.info).toHaveProperty('length', 1024);
        expect(decoded.info).toHaveProperty('piece length', 16384);
      } else {
        throw new Error('Decoded torrent data does not have the expected structure');
      }
    });
  });
});