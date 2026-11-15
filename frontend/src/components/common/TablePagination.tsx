import React from 'react';
import { Group, Pagination, Select, Text, Box } from '@mantine/core';

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  pageSizeOptions?: string[];
  disabled?: boolean;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = ['5', '10', '20', '50'],
  disabled = false,
}) => {
  if (totalCount === 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <Box mt="md" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Showing <Text span fw={600} c="dark">{startItem}</Text> to{' '}
            <Text span fw={600} c="dark">{endItem}</Text> of{' '}
            <Text span fw={600} c="dark">{totalCount}</Text> items
          </Text>
          <Group gap={4} ml="xs">
            <Text size="xs" c="dimmed">Per page:</Text>
            <Select
              size="xs"
              w={75}
              data={pageSizeOptions}
              value={String(pageSize)}
              onChange={(val) => {
                if (val) {
                  onPageSizeChange(Number(val));
                  onPageChange(1);
                }
              }}
              disabled={disabled}
              allowDeselect={false}
            />
          </Group>
        </Group>

        <Pagination
          total={Math.max(1, totalPages)}
          value={page}
          onChange={onPageChange}
          size="sm"
          radius="md"
          withEdges
          disabled={disabled || totalPages <= 1}
        />
      </Group>
    </Box>
  );
};
