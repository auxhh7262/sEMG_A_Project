const os = require('os');
let platform = null;
const { arch } = process;
if (os.type() == 'Windows_NT') {
  platform = 'win32';
} else if (os.type() == 'Darwin') {
  platform = 'darwin';
}

module.exports = {
  getAddonRelativePath(type) {
    if (type === 'wcc'
      || type === 'wcsc') {
      if (platform) {
        return `../build/${platform}_${arch}/${type}.node`;
      }
    }
  },
};
