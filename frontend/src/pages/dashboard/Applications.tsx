import {
  Badge,
  Button,
  CheckboxInput,
  FormInput,
  SelectInput,
  Table,
  TextInput,
} from '@adoptdontshop/components'
import {
  Application,
  ApplicationService,
} from '@adoptdontshop/libs/applications'
import { useUser } from 'contexts/auth/UserContext'
import React, { useEffect, useState } from 'react'

const Applications: React.FC = () => {
  const { rescue } = useUser()
  const [applications, setApplications] = useState<Application[]>([])
  const [searchTerm, setSearchTerm] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [onlyWaiting, setOnlyWaiting] = useState<boolean>(false)

  // Fetch applications data from backend on component mount
  useEffect(() => {
    if (!rescue) return
    const fetchApplications = async () => {
      try {
        const fetchedApplications =
          await ApplicationService.getApplicationsByRescueId(rescue.rescue_id)
        setApplications(fetchedApplications)
      } catch (error) {
        console.error('Error fetching applications:', error)
      }
    }
    fetchApplications()
  }, [rescue])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setFilterStatus(e.target.value)
  }

  const handleOnlyWaitingBooleanChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setOnlyWaiting((prevState) => !prevState)
  }

  const handleStatusUpdate = async (
    applicationId: string,
    newStatus: string,
  ) => {
    try {
      const updatedApplication = await ApplicationService.updateApplication(
        applicationId,
        { status: newStatus },
      )
      setApplications((prevApplications) =>
        prevApplications.map((app) =>
          app.application_id === applicationId ? updatedApplication : app,
        ),
      )
    } catch (error) {
      console.error(`Error updating application status:`, error)
    }
  }

  const filteredApplications = applications.filter((application) => {
    const matchesSearch =
      !searchTerm ||
      application.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      application.pet_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !filterStatus || application.status === filterStatus
    const matchesWaiting = !onlyWaiting || application.status === 'pending'

    return matchesSearch && matchesStatus && matchesWaiting
  })

  const filterOptions = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div>
      <h1>Applications {rescue?.rescue_id}</h1>
      <FormInput label="Search by first name or pet name">
        <TextInput
          value={searchTerm || ''}
          type="text"
          onChange={handleSearchChange}
        />
      </FormInput>
      <FormInput label="Filter by status">
        <SelectInput
          options={filterOptions}
          value={filterStatus}
          onChange={handleStatusFilterChange}
        />
      </FormInput>
      <FormInput label="Show only waiting applications">
        <CheckboxInput
          checked={onlyWaiting}
          onChange={handleOnlyWaitingBooleanChange}
        />
      </FormInput>
      <Table hasActions>
        <thead>
          <tr>
            <th>First name</th>
            <th>Pet name</th>
            <th>Description</th>
            <th>Status</th>
            <th>Actioned by</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredApplications.map((application) => (
            <tr key={application.application_id}>
              <td>{application.first_name}</td>
              <td>{application.pet_name}</td>
              <td>{application.description}</td>
              <td>
                <Badge>
                  {application.status.charAt(0).toUpperCase() +
                    application.status.slice(1)}
                </Badge>
              </td>
              <td>{application.actioned_by || 'N/A'}</td>
              <td>
                {application.status === 'pending' ? (
                  <>
                    <Button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          application.application_id,
                          'approved',
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          application.application_id,
                          'rejected',
                        )
                      }
                    >
                      Reject
                    </Button>
                  </>
                ) : (
                  <Badge
                    variant={
                      application.status === 'approved' ? 'success' : 'warning'
                    }
                  >
                    {application.status.charAt(0).toUpperCase() +
                      application.status.slice(1)}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

export default Applications
