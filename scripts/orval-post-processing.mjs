/**
 * Orval Post-Processing Utilities
 *
 * Post-processes Orval output to split hooks from fetchers for React Server Components compatibility.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Post-process Orval output to split hooks from fetchers.
 *
 * Orval generates both fetcher functions and SWR hooks in a single file.
 * This causes issues with React Server Components because SWR imports fail
 * in server contexts (SWR's react-server.mjs has no default export).
 *
 * This is a known Orval limitation:
 * - https://github.com/orval-labs/orval/issues/1576
 * - https://github.com/orval-labs/orval/issues/940
 *
 * Workaround: Split into fetchers.ts (server-safe) and hooks.ts (client-only).
 *
 * @param {string} serviceName - The name of the service to process
 * @param {string} outputDir - The base output directory for generated files
 */
export const splitHooksFile = async (serviceName, outputDir) => {
  const dir = join(outputDir, serviceName);
  const hooksPath = join(dir, 'hooks.ts');
  const fetchersPath = join(dir, 'fetchers.ts');

  const content = await readFile(hooksPath, 'utf-8');
  const lines = content.split('\n');

  let headerEndLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('*/')) {
      headerEndLine = i;
      break;
    }
  }
  const header = lines.slice(0, headerEndLine + 1).join('\n');

  const axiosImports = [];
  const swrImports = [];
  const swrTypeImports = [];
  const typeImports = [];

  let firstExportLine = lines.length;
  let currentImport = null;
  let currentImportLines = [];

  for (let i = headerEndLine + 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('export ')) {
      firstExportLine = i;
      break;
    }

    if (line.startsWith('import ') || line.startsWith('import type ')) {
      if (currentImport) {
        currentImport = null;
        currentImportLines = [];
      }

      if (line.includes("from '") || line.includes('from "')) {
        if (line.includes("from 'axios'") || line.includes('from "axios"')) {
          axiosImports.push(line);
        } else if (line.includes("from 'swr") || line.includes('from "swr')) {
          if (line.startsWith('import type')) {
            swrTypeImports.push(line);
          } else {
            swrImports.push(line);
          }
        } else if (line.includes('./types')) {
          typeImports.push(line);
        }
      } else {
        currentImport = line.startsWith('import type') ? 'type' : 'regular';
        currentImportLines = [line];
      }
    } else if (currentImportLines.length > 0) {
      currentImportLines.push(line);

      if (line.includes("from '") || line.includes('from "')) {
        const fullImport = currentImportLines.join('\n');
        if (
          fullImport.includes("from 'axios'") ||
          fullImport.includes('from "axios"')
        ) {
          axiosImports.push(fullImport);
        } else if (
          fullImport.includes("from 'swr") ||
          fullImport.includes('from "swr')
        ) {
          if (currentImport === 'type') {
            swrTypeImports.push(fullImport);
          } else {
            swrImports.push(fullImport);
          }
        } else if (fullImport.includes('./types')) {
          typeImports.push(fullImport);
        }
        currentImport = null;
        currentImportLines = [];
      }
    }
  }

  const exportBlocks = [];
  let currentBlock = [];
  let braceDepth = 0;
  let parenDepth = 0;
  let angleDepth = 0;
  let inBlock = false;
  let pendingComment = null;
  let commentComplete = false;

  const countChar = (str, char) => {
    const matches = str.match(new RegExp(`\\${char}`, 'g'));
    return matches ? matches.length : 0;
  };

  const processExportLine = (line, trimmed) => {
    if (trimmed.startsWith('/**') && !inBlock) {
      pendingComment = [line];
      commentComplete = trimmed.endsWith('*/') && trimmed !== '/**';
      return;
    }

    if (pendingComment && !commentComplete && !inBlock) {
      pendingComment.push(line);
      if (trimmed.includes('*/')) {
        commentComplete = true;
      }
      return;
    }

    if (trimmed.startsWith('export ') && !inBlock) {
      inBlock = true;
      if (pendingComment) {
        currentBlock = [...pendingComment, line];
        pendingComment = null;
        commentComplete = false;
      } else {
        currentBlock = [line];
      }

      braceDepth += countChar(line, '{') - countChar(line, '}');
      parenDepth += countChar(line, '(') - countChar(line, ')');
      angleDepth += countChar(line, '<') - countChar(line, '>');

      if (braceDepth === 0 && parenDepth === 0 && angleDepth <= 0) {
        angleDepth = 0;
        if (trimmed.endsWith(';')) {
          exportBlocks.push(currentBlock.join('\n'));
          currentBlock = [];
          inBlock = false;
          braceDepth = 0;
          parenDepth = 0;
        }
      }

      return;
    }

    if (inBlock) {
      currentBlock.push(line);

      braceDepth += countChar(line, '{') - countChar(line, '}');
      parenDepth += countChar(line, '(') - countChar(line, ')');

      if (braceDepth === 0 && parenDepth === 0) {
        if (trimmed.endsWith(';') || trimmed === '};' || trimmed === '}') {
          exportBlocks.push(currentBlock.join('\n'));
          currentBlock = [];
          inBlock = false;
          braceDepth = 0;
          parenDepth = 0;
          angleDepth = 0;
        }
      }
    }
  };

  lines.slice(firstExportLine).forEach((line) => {
    processExportLine(line, line.trim());
  });

  if (currentBlock.length > 0) {
    exportBlocks.push(currentBlock.join('\n'));
  }

  const hookBlocks = exportBlocks.filter((block) =>
    /export\s+const\s+use[A-Z]/.test(block),
  );
  const fetcherBlocks = exportBlocks.filter(
    (block) => !/export\s+const\s+use[A-Z]/.test(block),
  );

  const fetcherExports = fetcherBlocks.flatMap((block) => {
    const constMatches = [...block.matchAll(/export\s+const\s+(\w+)/g)].map(
      (m) => m[1],
    );
    const typeMatches = [...block.matchAll(/export\s+type\s+(\w+)/g)].map(
      (m) => m[1],
    );

    return [...constMatches, ...typeMatches];
  });

  const hasAxiosTypeImport = axiosImports.some(
    (imp) => imp.includes('import type') && imp.includes('from'),
  );
  const axiosTypeImport = hasAxiosTypeImport
    ? ''
    : "import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';";

  const fetcherCode = fetcherBlocks.join('\n');
  const needsArguments = fetcherCode.includes('Arguments');
  const swrTypeImport = needsArguments
    ? "import type { Arguments, Key } from 'swr';"
    : "import type { Key } from 'swr';";

  const fetchersContent = `${header}
${axiosImports.join('\n')}
${axiosTypeImport}

${swrTypeImport}

${typeImports.join('\n')}

${fetcherBlocks.join('\n\n')}
`;

  const hooksContent = `'use client';

${header}
${swrImports.join('\n')}
${swrTypeImports.join('\n')}

import type { AxiosError, AxiosRequestConfig } from 'axios';

${typeImports.join('\n')}

import {
  ${fetcherExports.join(',\n  ')},
} from './fetchers';

${hookBlocks.join('\n\n')}
`;

  await writeFile(fetchersPath, fetchersContent);
  await writeFile(hooksPath, hooksContent);
};
