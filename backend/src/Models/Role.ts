import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '../sequelize'
import { User, UserRole } from './'

interface RoleAttributes {
  role_id: number
  role_name: string
  created_at?: Date
  updated_at?: Date
}

interface RoleCreationAttributes extends Optional<RoleAttributes, 'role_id'> {}

class Role
  extends Model<RoleAttributes, RoleCreationAttributes>
  implements RoleAttributes
{
  public role_id!: number
  public role_name!: string
  public created_at!: Date
  public updated_at!: Date

  public static associate() {
    this.belongsToMany(User, { through: UserRole, foreignKey: 'role_id' })
  }
}

Role.init(
  {
    role_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    role_name: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'roles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
)

export default Role
