import React from 'react';
import { Select, type SelectProps, Text, Loader, Group } from '@mantine/core';

export interface PaginatedSelectOption {
  value: string;
  label: string;
  [key: string]: any;
}

export interface PaginatedSelectProps extends Omit<SelectProps, 'data'> {
  options: PaginatedSelectOption[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onSearchChange?: (search: string) => void;
}

export const PaginatedSelect: React.FC<PaginatedSelectProps> = ({
  options,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onSearchChange,
  onChange,
  value,
  ...selectProps
}) => {
  const SEE_MORE_VALUE = '__SEE_MORE_OPTION__';

  const selectData = React.useMemo(() => {
    const list = [...options];
    if (hasMore) {
      list.push({
        value: SEE_MORE_VALUE,
        label: isLoadingMore ? 'Loading more...' : '+ See more options',
      });
    }
    return list;
  }, [options, hasMore, isLoadingMore]);

  const handleOptionSubmit = (val: string) => {
    if (val === SEE_MORE_VALUE) {
      if (onLoadMore && !isLoadingMore) {
        onLoadMore();
      }
      return;
    }
    if (onChange) {
      onChange(val, selectData.find((o) => o.value === val) as any);
    }
  };

  return (
    <Select
      {...selectProps}
      value={value}
      data={selectData}
      onOptionSubmit={handleOptionSubmit}
      onSearchChange={onSearchChange}
      renderOption={({ option }) => {
        if (option.value === SEE_MORE_VALUE) {
          return (
            <Group justify="center" p="xs" style={{ width: '100%', cursor: 'pointer' }}>
              {isLoadingMore ? (
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="xs" fw={600} c="brand">Loading more...</Text>
                </Group>
              ) : (
                <Text size="xs" fw={600} c="blue.6">
                  + See more...
                </Text>
              )}
            </Group>
          );
        }
        return <Text size="sm">{option.label}</Text>;
      }}
    />
  );
};
