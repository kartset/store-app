import { Table, Title, Card, Text, Loader, Center, Badge } from '@mantine/core';
import { useStores } from '../api';

export function StoreList() {
  const { data: stores, isLoading, error } = useStores();

  if (isLoading) return <Center h={200}><Loader /></Center>;
  if (error) return <Text c="red">Error loading stores.</Text>;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={2} mb="md">Stores</Title>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Store Name</Table.Th>
            <Table.Th>Organization</Table.Th>
            <Table.Th>Location</Table.Th>
            <Table.Th>Contact</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {stores?.map((store) => (
            <Table.Tr key={store.id}>
              <Table.Td fw={500}>{store.name}</Table.Td>
              <Table.Td>
                {store.organization_name ? (
                  <Badge color="blue" variant="light">{store.organization_name}</Badge>
                ) : (
                  <Text size="sm" c="dimmed">No Org</Text>
                )}
              </Table.Td>
              <Table.Td>{store.location}</Table.Td>
              <Table.Td>{store.contact_email}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
