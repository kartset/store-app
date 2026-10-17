import React from 'react';
import {
  Text,
  Title,
  Table,
  Blockquote,
  Code,
  Paper,
  Box,
  Stack,
  ThemeIcon,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Table detection: starts with '|' and contains '|'
    if (line.trim().startsWith('|') && line.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // Parse header
        const headerCells = tableLines[0]
          .split('|')
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
          .map((c) => c.trim());

        // Skip separator line if present (e.g. |---|---|)
        const startIndex = tableLines[1].includes('---') ? 2 : 1;
        const rows: string[][] = [];

        for (let r = startIndex; r < tableLines.length; r++) {
          const cells = tableLines[r]
            .split('|')
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            .map((c) => c.trim());
          rows.push(cells);
        }

        elements.push(
          <Paper key={`table-${i}`} withBorder radius="sm" p={0} my="xs" style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withColumnBorders verticalSpacing="xs">
              <Table.Thead style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                <Table.Tr>
                  {headerCells.map((h, idx) => (
                    <Table.Th key={idx} style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {renderFormattedInline(h)}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row, rIdx) => (
                  <Table.Tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <Table.Td key={cIdx} style={{ fontSize: '13px' }}>
                        {renderFormattedInline(cell)}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        );
      }
      continue;
    }

    // Code blocks: ```
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <Box key={`code-${i}`} my="xs">
          <Code block style={{ fontSize: '12px', lineHeight: 1.5, borderRadius: '6px' }}>
            {codeLines.join('\n')}
          </Code>
        </Box>
      );
      continue;
    }

    // Headings
    if (line.startsWith('#### ')) {
      elements.push(
        <Title key={`h4-${i}`} order={5} mt="sm" mb={4} fw={700}>
          {renderFormattedInline(line.replace('#### ', ''))}
        </Title>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <Title key={`h3-${i}`} order={4} mt="sm" mb={4} fw={700} style={{ letterSpacing: '-0.01em' }}>
          {renderFormattedInline(line.replace('### ', ''))}
        </Title>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <Title key={`h2-${i}`} order={3} mt="md" mb="xs" fw={700}>
          {renderFormattedInline(line.replace('## ', ''))}
        </Title>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <Title key={`h1-${i}`} order={2} mt="md" mb="xs" fw={800}>
          {renderFormattedInline(line.replace('# ', ''))}
        </Title>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteText = line.replace('> ', '');
      elements.push(
        <Blockquote
          key={`quote-${i}`}
          icon={<ThemeIcon size="xs" variant="transparent"><IconInfoCircle size={14} /></ThemeIcon>}
          color="indigo"
          p="xs"
          my="xs"
          styles={{ root: { fontSize: '12px', borderLeftWidth: '3px' } }}
        >
          {renderFormattedInline(quoteText)}
        </Blockquote>
      );
      i++;
      continue;
    }

    // List item (bullets)
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const bulletText = line.trim().substring(2);
      elements.push(
        <Box key={`li-${i}`} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <Text size="sm" c="brand" style={{ fontWeight: 700, lineHeight: 1.6 }}>•</Text>
          <Text size="sm" style={{ flex: 1, lineHeight: 1.6 }}>
            {renderFormattedInline(bulletText)}
          </Text>
        </Box>
      );
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<Box key={`empty-${i}`} h={6} />);
      i++;
      continue;
    }

    // Standard paragraph
    elements.push(
      <Text key={`p-${i}`} size="sm" style={{ lineHeight: 1.6, marginBottom: '6px' }}>
        {renderFormattedInline(line)}
      </Text>
    );
    i++;
  }

  return <Stack gap={2}>{elements}</Stack>;
};

/**
 * Helper to render bold (**text**), italics (*text*), inline code (`code`),
 * and highlight ₹ Indian Rupee amounts.
 */
function renderFormattedInline(text: string): React.ReactNode {
  // Regex to split by bold, code, italics
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  // Process bold: **text**
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const codeMatch = remaining.match(/`(.*?)`/);

    // Pick whichever match comes first
    let match: RegExpMatchArray | null = null;
    let type: 'bold' | 'code' | null = null;

    if (boldMatch && codeMatch) {
      if ((boldMatch.index ?? 0) <= (codeMatch.index ?? 0)) {
        match = boldMatch;
        type = 'bold';
      } else {
        match = codeMatch;
        type = 'code';
      }
    } else if (boldMatch) {
      match = boldMatch;
      type = 'bold';
    } else if (codeMatch) {
      match = codeMatch;
      type = 'code';
    }

    if (!match || match.index === undefined) {
      // Process italics in the rest
      parts.push(renderItalics(remaining, keyIdx++));
      break;
    }

    // Preceding text before match
    if (match.index > 0) {
      const before = remaining.substring(0, match.index);
      parts.push(renderItalics(before, keyIdx++));
    }

    // Matched item
    if (type === 'bold') {
      parts.push(
        <strong key={`bold-${keyIdx++}`} style={{ fontWeight: 700, color: 'inherit' }}>
          {match[1]}
        </strong>
      );
    } else if (type === 'code') {
      parts.push(
        <Code key={`code-${keyIdx++}`} style={{ fontSize: '11px', padding: '1px 5px' }}>
          {match[1]}
        </Code>
      );
    }

    remaining = remaining.substring(match.index + match[0].length);
  }

  return <>{parts}</>;
}

function renderItalics(text: string, keyPrefix: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/);
    if (!italicMatch || italicMatch.index === undefined) {
      parts.push(<React.Fragment key={`${keyPrefix}-${idx++}`}>{remaining}</React.Fragment>);
      break;
    }

    if (italicMatch.index > 0) {
      parts.push(
        <React.Fragment key={`${keyPrefix}-${idx++}`}>
          {remaining.substring(0, italicMatch.index)}
        </React.Fragment>
      );
    }

    parts.push(
      <em key={`${keyPrefix}-${idx++}`} style={{ fontStyle: 'italic', opacity: 0.9 }}>
        {italicMatch[1]}
      </em>
    );

    remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
  }

  return <>{parts}</>;
}
