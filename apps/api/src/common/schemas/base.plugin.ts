import { Schema, Types } from 'mongoose';

export function basePlugin(schema: Schema) {
  schema.add({
    createdBy: { type: Types.ObjectId, ref: 'User', required: false },
  });
  schema.set('timestamps', true);
  schema.set('toJSON', { virtuals: true });
  schema.set('toObject', { virtuals: true });
}
