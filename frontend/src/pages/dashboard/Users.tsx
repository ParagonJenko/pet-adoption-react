import {
  Badge,
  Button,
  DateTime,
  FormInput,
  SelectInput,
  Table,
  TextInput,
} from '@adoptdontshop/components'
import { AdminService } from '@adoptdontshop/libs/admin'
import { UserService } from '@adoptdontshop/libs/users'
import { Role } from '@adoptdontshop/permissions'
import { useUser } from 'contexts/auth/UserContext'
import { RoleDisplay } from 'contexts/permissions/Permission'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'

// Style definitions
const Container = styled.div`
  padding: 1rem;
`

const Title = styled.h1`
  margin-bottom: 2rem;
  font-size: 1.8rem;
`

const FilterContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
`

const BadgeWrapper = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`

const TableContainer = styled.div`
  margin-top: 2rem;
`

// Types
type UserWithRoles = {
  user_id: string
  first_name: string
  last_name: string
  email: string
  roles: RoleDisplay[]
  email_verified: boolean
  reset_token_force_flag?: boolean | null
  created_at?: string
  updated_at?: string
}

type UsersProps = Record<string, never>

// Component
export const Users: React.FC<UsersProps> = () => {
  const { user: currentUser } = useUser()
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([])
  const [searchByEmailName, setSearchByEmailName] = useState<string>('')
  const [filterByRole, setFilterByRole] = useState<Role | 'all'>('all')
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await UserService.getUsers()
        const transformedUsers = users.map((user) => ({
          ...user,
          roles: user.roles.map((role) => ({
            role_id: role as Role,
            role_name: role as RoleDisplay['role_name'],
          })),
        }))
        setUsers(transformedUsers)
        setFilteredUsers(transformedUsers)
      } catch (error) {
        console.error('Error fetching users:', error)
      }
    }
    fetchUsers()
  }, [])

  useEffect(() => {
    const filtered = users.filter((user) => {
      const matchesSearch =
        !searchByEmailName ||
        (user.email?.toLowerCase().includes(searchByEmailName.toLowerCase()) ??
          false) ||
        (user.first_name
          ?.toLowerCase()
          .includes(searchByEmailName.toLowerCase()) ??
          false) ||
        (user.last_name
          ?.toLowerCase()
          .includes(searchByEmailName.toLowerCase()) ??
          false)

      const matchesRole =
        filterByRole === 'all' ||
        user.roles.some((role) => role.role_id === filterByRole)

      return matchesSearch && matchesRole
    })
    setFilteredUsers(filtered)
  }, [searchByEmailName, filterByRole, users])

  const handleAddRoleClick = (userId: string) => {
    setShowRoleDropdown(userId === showRoleDropdown ? null : userId)
  }

  const handleRoleSelect = async (userId: string, selectedRole: Role) => {
    try {
      await AdminService.addRoleToUser(userId, selectedRole)
      const updatedUsers = users.map((user) =>
        user.user_id === userId
          ? {
              ...user,
              roles: [
                ...user.roles,
                { role_id: selectedRole, role_name: selectedRole },
              ],
            }
          : user,
      )
      setUsers(updatedUsers)
      setFilteredUsers(updatedUsers)
      setShowRoleDropdown(null)
      alert('Role added')
    } catch (error) {
      console.error('Failed to assign role:', error)
    }
  }

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      await AdminService.removeRoleFromUser(userId, roleId)
      const updatedUsers = users.map((user) =>
        user.user_id === userId
          ? {
              ...user,
              roles: user.roles.filter((role) => role.role_id !== roleId),
            }
          : user,
      )
      setUsers(updatedUsers)
      setFilteredUsers(updatedUsers)
      alert('Role removed')
    } catch (error) {
      console.error('Failed to remove role:', error)
    }
  }

  return (
    <Container>
      <Title>Users</Title>
      <FilterContainer>
        <FormInput label="Search by name or email">
          <TextInput
            type="text"
            value={searchByEmailName}
            onChange={(e) => setSearchByEmailName(e.target.value)}
          />
        </FormInput>
        <FormInput label="Filter by Role">
          <SelectInput
            value={filterByRole}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFilterByRole(e.target.value as Role | 'all')
            }
            options={[
              { value: 'all', label: 'All Roles' },
              ...Object.values(Role).map((role) => ({
                value: role,
                label: role.replace(/_/g, ' ').toLowerCase(),
              })),
            ]}
          />
        </FormInput>
      </FilterContainer>

      <TableContainer>
        <Table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>Email Verified</th>
              <th>Reset Token Forced</th>
              <th>Created At</th>
              <th>Updated At</th>
              <th>Roles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.user_id}>
                <td>{user.user_id}</td>
                <td>{user.first_name}</td>
                <td>{user.last_name}</td>
                <td>{user.email}</td>
                <td>{user.email_verified ? 'Yes' : 'No'}</td>
                <td>{user.reset_token_force_flag ? 'Yes' : 'No'}</td>
                <td>{<DateTime timestamp={user.created_at || ''} />}</td>
                <td>{<DateTime timestamp={user.updated_at || ''} />}</td>
                <td>
                  <BadgeWrapper>
                    {user.roles.map((role) => (
                      <Badge
                        key={role.role_id}
                        variant="info"
                        onActionClick={
                          currentUser && currentUser.user_id !== user.user_id
                            ? () => handleRemoveRole(user.user_id, role.role_id)
                            : undefined
                        }
                        showAction={
                          currentUser && currentUser.user_id !== user.user_id
                        }
                      >
                        {role.role_name.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    ))}
                    {currentUser && currentUser.user_id !== user.user_id && (
                      <>
                        <Badge
                          variant="success"
                          onClick={() => handleAddRoleClick(user.user_id)}
                        >
                          +
                        </Badge>
                        {showRoleDropdown === user.user_id && (
                          <SelectInput
                            options={Object.values(Role).map((role) => ({
                              value: role,
                              label: role.replace(/_/g, ' ').toUpperCase(),
                            }))}
                            placeholder="Choose a role"
                            onChange={(e) =>
                              handleRoleSelect(
                                user.user_id,
                                e.target.value as Role,
                              )
                            }
                          />
                        )}
                      </>
                    )}
                  </BadgeWrapper>
                </td>
                <td>
                  <Button variant="danger" type="button">
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>
    </Container>
  )
}
