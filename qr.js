'use strict';

/*
 * Dependency-free byte-mode QR encoder, error correction M.
 * Adapted from the MIT-licensed Project Nayuki QR Code generator concepts:
 * https://www.nayuki.io/page/qr-code-generator-library
 */
(function exposeMonaQr(global) {
  const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  const EXP = new Array(512);
  const LOG = new Array(256);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    EXP[index] = value;
    LOG[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) EXP[index] = EXP[index - 255];

  function multiply(left, right) {
    return left && right ? EXP[LOG[left] + LOG[right]] : 0;
  }

  function generatorPolynomial(degree) {
    let polynomial = [1];
    for (let root = 0; root < degree; root += 1) {
      const next = new Array(polynomial.length + 1).fill(0);
      for (let index = 0; index < polynomial.length; index += 1) {
        next[index] ^= multiply(polynomial[index], EXP[root]);
        next[index + 1] ^= polynomial[index];
      }
      polynomial = next;
    }
    return polynomial.reverse();
  }

  function remainder(data, generator) {
    const result = new Array(generator.length - 1).fill(0);
    for (const byte of data) {
      const factor = byte ^ result[0];
      result.shift();
      result.push(0);
      if (factor) {
        for (let index = 0; index < result.length; index += 1) result[index] ^= multiply(generator[index + 1], factor);
      }
    }
    return result;
  }

  function rawDataModules(version) {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      const count = Math.floor(version / 7) + 2;
      result -= (25 * count - 10) * count - 55;
      if (version >= 7) result -= 36;
    }
    return result;
  }

  function totalCodewords(version) {
    return Math.floor(rawDataModules(version) / 8);
  }

  function dataCodewords(version) {
    return totalCodewords(version) - ECC[version] * BLOCKS[version];
  }

  function alignmentPositions(version) {
    if (version === 1) return [];
    const count = Math.floor(version / 7) + 2;
    const size = version * 4 + 17;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    const result = [6];
    for (let position = size - 7; result.length < count; position -= step) result.splice(1, 0, position);
    return result;
  }

  function bit(valueToRead, index) {
    return ((valueToRead >>> index) & 1) !== 0;
  }

  function makeMatrix(text) {
    const bytes = [...new TextEncoder().encode(String(text))];
    let version = -1;
    for (let candidate = 1; candidate <= 40; candidate += 1) {
      const countBits = candidate <= 9 ? 8 : 16;
      if (bytes.length < 2 ** countBits && 4 + countBits + bytes.length * 8 <= dataCodewords(candidate) * 8) {
        version = candidate;
        break;
      }
    }
    if (version < 0) throw new Error('Chuỗi vượt dung lượng QR Code phiên bản 40.');

    const capacity = dataCodewords(version) * 8;
    const bits = [];
    const push = (number, count) => {
      for (let index = count - 1; index >= 0; index -= 1) bits.push((number >>> index) & 1);
    };
    push(4, 4);
    push(bytes.length, version <= 9 ? 8 : 16);
    for (const byte of bytes) push(byte, 8);
    push(0, Math.min(4, capacity - bits.length));
    if (bits.length % 8) push(0, 8 - (bits.length % 8));
    let firstPad = true;
    while (bits.length < capacity) {
      push(firstPad ? 0xec : 0x11, 8);
      firstPad = !firstPad;
    }
    const data = [];
    for (let offset = 0; offset < bits.length; offset += 8) {
      let byte = 0;
      for (let index = 0; index < 8; index += 1) byte = (byte << 1) | bits[offset + index];
      data.push(byte);
    }

    const blockCount = BLOCKS[version];
    const eccLength = ECC[version];
    const rawCodewords = totalCodewords(version);
    const shortCount = blockCount - (rawCodewords % blockCount);
    const shortLength = Math.floor(rawCodewords / blockCount);
    const generator = generatorPolynomial(eccLength);
    const blocks = [];
    let dataOffset = 0;
    for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
      const dataLength = shortLength - eccLength + (blockIndex < shortCount ? 0 : 1);
      const blockData = data.slice(dataOffset, dataOffset + dataLength);
      dataOffset += dataLength;
      const current = blockData.concat(remainder(blockData, generator));
      if (blockIndex < shortCount) current.splice(dataLength, 0, 0);
      blocks.push(current);
    }
    const codewords = [];
    for (let column = 0; column < blocks[0].length; column += 1) {
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
        if (column !== shortLength - eccLength || blockIndex >= shortCount) codewords.push(blocks[blockIndex][column]);
      }
    }

    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFunction = (x, y, dark) => {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    };
    const drawFinder = (centerX, centerY) => {
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          const x = centerX + dx;
          const y = centerY + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, distance !== 2 && distance !== 4);
        }
      }
    };
    const drawAlignment = (centerX, centerY) => {
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) setFunction(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    };
    const drawFormat = (mask) => {
      let rest = mask;
      for (let index = 0; index < 10; index += 1) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
      const format = ((mask << 10) | rest) ^ 0x5412;
      for (let index = 0; index <= 5; index += 1) setFunction(8, index, bit(format, index));
      setFunction(8, 7, bit(format, 6));
      setFunction(8, 8, bit(format, 7));
      setFunction(7, 8, bit(format, 8));
      for (let index = 9; index < 15; index += 1) setFunction(14 - index, 8, bit(format, index));
      for (let index = 0; index <= 7; index += 1) setFunction(size - 1 - index, 8, bit(format, index));
      for (let index = 8; index < 15; index += 1) setFunction(8, size - 15 + index, bit(format, index));
      setFunction(8, size - 8, true);
    };

    for (let index = 0; index < size; index += 1) {
      setFunction(6, index, index % 2 === 0);
      setFunction(index, 6, index % 2 === 0);
    }
    drawFinder(3, 3);
    drawFinder(size - 4, 3);
    drawFinder(3, size - 4);
    const positions = alignmentPositions(version);
    for (let row = 0; row < positions.length; row += 1) {
      for (let column = 0; column < positions.length; column += 1) {
        const overlaps = (row === 0 && column === 0) || (row === 0 && column === positions.length - 1) || (row === positions.length - 1 && column === 0);
        if (!overlaps) drawAlignment(positions[row], positions[column]);
      }
    }
    drawFormat(0);
    if (version >= 7) {
      let rest = version;
      for (let index = 0; index < 12; index += 1) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
      const versionBits = (version << 12) | rest;
      for (let index = 0; index < 18; index += 1) {
        const primary = size - 11 + (index % 3);
        const secondary = Math.floor(index / 3);
        setFunction(primary, secondary, bit(versionBits, index));
        setFunction(secondary, primary, bit(versionBits, index));
      }
    }
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical += 1) {
        for (let offset = 0; offset < 2; offset += 1) {
          const x = right - offset;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vertical : vertical;
          if (!isFunction[y][x] && bitIndex < codewords.length * 8) {
            modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
            bitIndex += 1;
          }
        }
      }
    }

    const maskBit = (mask, x, y) => {
      if (mask === 0) return (x + y) % 2 === 0;
      if (mask === 1) return y % 2 === 0;
      if (mask === 2) return x % 3 === 0;
      if (mask === 3) return (x + y) % 3 === 0;
      if (mask === 4) return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      if (mask === 5) return ((x * y) % 2) + ((x * y) % 3) === 0;
      if (mask === 6) return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    };
    const applyMask = (mask) => {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) if (!isFunction[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
      }
    };
    const penalty = () => {
      let score = 0;
      const scan = (getter) => {
        let subtotal = 0;
        for (let line = 0; line < size; line += 1) {
          const values = [0, 0, 0, 0];
          for (let index = 0; index < size; index += 1) values.push(getter(line, index) ? 1 : 0);
          values.push(0, 0, 0, 0);
          let run = 0;
          let previous = -1;
          for (const current of values) {
            if (current === previous) run += 1;
            else {
              if (previous === 1 && run >= 5) subtotal += 3 + run - 5;
              previous = current;
              run = 1;
            }
          }
          for (let offset = 0; offset + 11 <= values.length; offset += 1) {
            const pattern = values.slice(offset, offset + 11).join('');
            if (pattern === '10111010000' || pattern === '00001011101') subtotal += 40;
          }
        }
        return subtotal;
      };
      score += scan((line, index) => modules[line][index]);
      score += scan((line, index) => modules[index][line]);
      for (let y = 0; y < size - 1; y += 1) {
        for (let x = 0; x < size - 1; x += 1) {
          const color = modules[y][x];
          if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) score += 3;
        }
      }
      let dark = 0;
      for (const row of modules) for (const module of row) if (module) dark += 1;
      score += (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
      return score;
    };
    let bestMask = 0;
    let bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask += 1) {
      applyMask(mask);
      drawFormat(mask);
      const score = penalty();
      if (score < bestPenalty) {
        bestPenalty = score;
        bestMask = mask;
      }
      applyMask(mask);
    }
    applyMask(bestMask);
    drawFormat(bestMask);
    return modules;
  }

  function renderCanvas(canvas, text) {
    const matrix = makeMatrix(text);
    const quiet = 4;
    const maxPixels = 280;
    const scale = Math.max(1, Math.floor(maxPixels / (matrix.length + quiet * 2)));
    const pixels = (matrix.length + quiet * 2) * scale;
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, pixels, pixels);
    context.fillStyle = '#000000';
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix.length; x += 1) {
        if (matrix[y][x]) context.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
  }

  global.MonaQr = { makeMatrix, renderCanvas };
}(globalThis));
