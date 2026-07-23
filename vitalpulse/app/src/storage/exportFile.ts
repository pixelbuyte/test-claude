import { File, Paths } from 'expo-file-system';

/** Writes plain text to a fresh file in the cache directory and returns it, ready to share. */
export function writeExportFile(filename: string, contents: string): File {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  return file;
}
