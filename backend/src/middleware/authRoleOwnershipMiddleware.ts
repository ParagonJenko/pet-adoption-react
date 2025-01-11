import { NextFunction, Response } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../Models'
import { AuditLogger } from '../services/auditLogService'
import {
  getRolesForUser,
  verifyUserHasRole,
} from '../services/permissionService'
import { verifyRescueOwnership } from '../services/rescueService'
import { AuthenticatedRequest } from '../types/AuthenticatedRequest'

type AuthOptions = {
  requiredRole?: string
  ownershipCheck?: (req: AuthenticatedRequest) => Promise<boolean>
  verifyRescueOwnership?: boolean
}

// Helper function to check rescue ownership
const checkRescueOwnership = async (
  req: AuthenticatedRequest,
): Promise<boolean> => {
  if (!req.user?.user_id) return false
  const rescueId = req.params.rescueId
  if (!rescueId) return false
  return verifyRescueOwnership(req.user.user_id, rescueId)
}

export const authRoleOwnershipMiddleware = ({
  requiredRole,
  ownershipCheck,
  verifyRescueOwnership: shouldVerifyRescue,
}: AuthOptions = {}) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      AuditLogger.logAction(
        'AuthService',
        'Authentication failed due to missing or invalid token',
        'WARNING',
      )
      return res
        .status(401)
        .json({ message: 'Authentication token missing or invalid' })
    }

    const token = authHeader.split(' ')[1]

    try {
      const secretKey = process.env.SECRET_KEY as string
      const decoded = jwt.verify(token, secretKey) as { userId: string }

      if (!decoded || !decoded.userId) {
        AuditLogger.logAction(
          'AuthService',
          'Authentication failed due to missing user ID in token',
          'WARNING',
        )
        return res.status(401).json({ message: 'Invalid token' })
      }

      const user = await User.findByPk(decoded.userId)

      if (!user) {
        AuditLogger.logAction(
          'AuthService',
          `Authentication failed: User with ID ${decoded.userId} not found`,
          'WARNING',
        )
        return res.status(401).json({ message: 'User not found' })
      }

      // Set user in the request
      req.user = user
      const userId = user.user_id

      // Check role if required
      if (requiredRole && !(await verifyUserHasRole(userId, requiredRole))) {
        await AuditLogger.logAction(
          'RoleCheckMiddleware',
          `User with ID: ${userId} attempted to access a resource requiring role: ${requiredRole} but does not have this role`,
          'WARNING',
          userId,
        )
        return res.status(403).json({ message: 'Forbidden: Insufficient role' })
      }

      // Check rescue ownership if required
      if (shouldVerifyRescue) {
        const hasOwnership = await checkRescueOwnership(req)
        if (!hasOwnership) {
          const roles = await getRolesForUser(userId)
          // Only allow admin to bypass ownership check
          if (!roles.includes('admin')) {
            await AuditLogger.logAction(
              'AuthService',
              `User ${userId} attempted to access rescue they don't own`,
              'WARNING',
              userId,
            )
            return res
              .status(403)
              .json({ message: 'Insufficient permissions for this rescue' })
          }
        }
      }

      // Check custom ownership if provided
      if (ownershipCheck && !(await ownershipCheck(req))) {
        await AuditLogger.logAction(
          'AuthService',
          `User ${userId} failed ownership check`,
          'WARNING',
          userId,
        )
        return res.status(403).json({ message: 'Insufficient permissions' })
      }

      await AuditLogger.logAction(
        'RoleOwnershipMiddleware',
        `User with ID: ${userId} passed all authorization checks`,
        'INFO',
        userId,
      )
      next()
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        AuditLogger.logAction(
          'AuthService',
          `JWT authentication failed with error: ${error.message}`,
          'ERROR',
        )
        return res.status(401).json({ message: 'JWT token expired or invalid' })
      } else if (error instanceof Error) {
        AuditLogger.logAction(
          'AuthService',
          `Authentication failed with error: ${error.message}`,
          'ERROR',
        )
        return res.status(403).json({ message: 'Forbidden' })
      } else {
        AuditLogger.logAction(
          'AuthService',
          'Authentication failed due to an unknown error',
          'ERROR',
        )
        return res.status(403).json({ message: 'Forbidden' })
      }
    }
  }
}
