import ts from 'typescript';
import { Converter, ParameterType, ReflectionKind } from 'typedoc';

/**
 * TypeDoc plugin to validate `@example` code blocks for syntax correctness
 * and adherence to ICV documentation rules (no placeholder data).
 *
 * @param {import('typedoc').Application} app
 */
export function load(app) {
  app.options.addDeclaration({
    name: 'checkExampleSyntax',
    type: ParameterType.Boolean,
    help: 'Validate TypeScript / TSX syntax in @example code blocks.',
    defaultValue: true,
  });

  app.options.addDeclaration({
    name: 'checkExamplePlaceholders',
    type: ParameterType.Boolean,
    help: 'Warn when generic placeholder data (e.g. foo, bar, baz) is detected in @example code blocks.',
    defaultValue: true,
  });

  app.options.addDeclaration({
    name: 'warnMissingExamples',
    type: ParameterType.Boolean,
    help: 'Warn when major exported declarations (Interface, TypeAlias, Class) are missing an @example block.',
    defaultValue: false,
  });

  app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
    const checkSyntax = app.options.getValue('checkExampleSyntax');
    const checkPlaceholders = app.options.getValue('checkExamplePlaceholders');
    const warnMissing = app.options.getValue('warnMissingExamples');

    if (!checkSyntax && !checkPlaceholders && !warnMissing) {
      return;
    }

    const project = context.project;
    const reflections = project.getReflectionsByKind(ReflectionKind.All);

    let checkedCount = 0;
    let syntaxErrorCount = 0;
    let placeholderWarningCount = 0;
    let missingExampleCount = 0;

    const placeholderPattern = /\b(foo|bar|baz)\b/i;

    for (const reflection of reflections) {
      const comment = reflection.comment || reflection.signatures?.[0]?.comment;
      const exampleTags = comment?.blockTags?.filter((tag) => tag.tag === '@example') || [];

      const sourceLoc = reflection.sources?.[0]
        ? `${reflection.sources[0].fileName}:${reflection.sources[0].line}`
        : reflection.name;

      // Check for missing examples on major exported declarations if enabled
      if (warnMissing && exampleTags.length === 0) {
        const isMajorDeclaration = (reflection.kind & (ReflectionKind.Interface | ReflectionKind.TypeAlias | ReflectionKind.Class)) !== 0;
        const isExported = reflection.parent === project || reflection.parent?.kind === ReflectionKind.Module;

        if (isMajorDeclaration && isExported) {
          missingExampleCount++;
          app.logger.warn(`[example-checker] ${sourceLoc}: Missing mandatory @example tag on ${reflection.name}`);
        }
      }

      if (exampleTags.length === 0) {
        continue;
      }

      for (const tag of exampleTags) {
        checkedCount++;
        const codeBlocks = extractCodeBlocks(tag.content);

        for (const block of codeBlocks) {
          if (checkSyntax && ['ts', 'tsx', 'js', 'jsx'].includes(block.lang.toLowerCase())) {
            const scriptKind = ['tsx', 'jsx'].includes(block.lang.toLowerCase())
              ? ts.ScriptKind.TSX
              : ts.ScriptKind.TS;

            const sourceFile = ts.createSourceFile(
              `example.${block.lang}`,
              block.code,
              ts.ScriptTarget.Latest,
              true,
              scriptKind,
            );

            if (sourceFile.parseDiagnostics.length > 0) {
              syntaxErrorCount++;
              for (const diag of sourceFile.parseDiagnostics) {
                const message = typeof diag.messageText === 'string'
                  ? diag.messageText
                  : diag.messageText.messageText;
                app.logger.warn(
                  `[example-checker] ${sourceLoc}: Syntax error in @example for ${reflection.name} (${block.lang}): ${message}`,
                );
              }
            }
          }

          if (checkPlaceholders && placeholderPattern.test(block.code)) {
            placeholderWarningCount++;
            app.logger.warn(
              `[example-checker] ${sourceLoc}: Placeholder data detected in @example for ${reflection.name}. ICV guidelines require realistic public health data.`,
            );
          }
        }
      }
    }

    app.logger.info(
      `[example-checker] Verified ${checkedCount} @example block(s): ${syntaxErrorCount} syntax error(s), ${placeholderWarningCount} placeholder warning(s), ${missingExampleCount} missing.`,
    );
  });
}

/**
 * Extracts fenced code blocks or raw code from TypeDoc comment tag content.
 *
 * @param {import('typedoc').CommentDisplayPart[] | string} content
 * @returns {Array<{ lang: string, code: string }>}
 */
function extractCodeBlocks(content) {
  const fullText = Array.isArray(content)
    ? content.map((part) => part.text).join('')
    : typeof content === 'string'
      ? content
      : '';

  const blocks = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match;

  while ((match = fenceRegex.exec(fullText)) !== null) {
    blocks.push({
      lang: match[1]?.trim() || 'ts',
      code: match[2].trim(),
    });
  }

  // Fallback: if no backticks were used, treat whole trimmed content as a code snippet
  if (blocks.length === 0 && fullText.trim()) {
    blocks.push({
      lang: 'ts',
      code: fullText.trim(),
    });
  }

  return blocks;
}
