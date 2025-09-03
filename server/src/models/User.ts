import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
    username: string;
    email: string;
    passwordHash: string;
    picture?: string;
    createdAt: Date;
}

const UserSchema: Schema<IUser> = new Schema<IUser>({
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    picture: { type: String },
    createdAt: { type: Date, default: Date.now }
});

UserSchema.index({ email: 1 }, { unique: true });

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;


