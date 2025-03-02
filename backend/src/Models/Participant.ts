// src/models/Participant.ts
import { Association, DataTypes, Model, Optional } from 'sequelize'
import { Conversation, User } from '.'
import sequelize from '../sequelize'

interface ParticipantAttributes {
  participant_id: string
  user_id?: string
  conversation_id?: string
  rescue_id?: string
  participant_type?: string
  created_at?: Date
  updated_at?: Date
}

interface ParticipantCreationAttributes
  extends Optional<ParticipantAttributes, 'participant_id'> {}

class Participant
  extends Model<ParticipantAttributes, ParticipantCreationAttributes>
  implements ParticipantAttributes
{
  public participant_id!: string
  public user_id!: string
  public conversation_id!: string
  public rescue_id!: string
  public participant_type!: string
  public created_at!: Date
  public updated_at!: Date

  // Optional associations
  public readonly User?: User
  public readonly Conversation?: Conversation

  public static associations: {
    User: Association<Participant, User>
    Conversation: Association<Participant, Conversation>
  }
}

Participant.init(
  {
    participant_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: sequelize.literal(
        `'participant_' || left(md5(random()::text), 12)`,
      ),
    },
    user_id: {
      type: DataTypes.STRING,
    },
    conversation_id: {
      type: DataTypes.STRING,
    },
    rescue_id: {
      type: DataTypes.STRING,
    },
    participant_type: {
      type: DataTypes.STRING,
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
    tableName: 'participants',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
)

export default Participant
