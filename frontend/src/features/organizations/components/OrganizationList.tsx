import { Table, Title, Card, Text, Loader, Center } from '@mantine/core';
import { useOrganizations } from '../api';

export function OrganizationList() {
  const { data: organizations, isLoading, error } = useOrganizations();

  if (isLoading) return <Center h={200}><Loader /></Center>;
  if (error) return <Text c="red">Error loading organizations.</Text>;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={2} mb="md">Organizations</Title>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Phone</Table.Th>
            <Table.Th>Address</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {organizations?.map((org) => (
            <Table.Tr key={org.id}>
              <Table.Td>{org.name}</Table.Td>
              <Table.Td>{org.contact_email}</Table.Td>
              <Table.Td>{org.contact_phone}</Table.Td>
              <Table.Td>{org.address}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
