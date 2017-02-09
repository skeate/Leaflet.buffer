/*
 * Webpack apparently does not handle things being named System very well.
 * So this is a direct copy of jsts/src/java/lang/System.js, with the System
 * function renamed.
 *
 * This is used in place of JSTS's System file by way of the Webpack
 * NormalModuleReplacementPlugin.
 */
/* eslint-disable */
export default function JavaSystem () { }

JavaSystem.arraycopy = (src, srcPos, dest, destPos, len) => {
  let c = 0
  for (let i = srcPos; i < srcPos + len; i++) {
    dest[destPos + c] = src[i]
    c++
  }
}

JavaSystem.getProperty = (name) => {
  return {
    'line.separator': '\n'
  }[name]
}
