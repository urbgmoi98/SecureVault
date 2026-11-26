const crypto = require('crypto');
const knex = require('../config/db');
const { encrypt, decrypt } = require('../crypto/cipher');

function toNote(row) {
  return {
    id: row.id,
    title: decrypt(row.title_ciphertext, `${row.user_id}:${row.id}:title`),
    body: decrypt(row.body_ciphertext, `${row.user_id}:${row.id}:body`),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

exports.list = async (userId) => {
  const rows = await knex('notes')
    .where({ user_id: userId })
    .select('id', 'user_id', 'title_ciphertext', 'body_ciphertext', 'created_at', 'updated_at')
    .orderBy('updated_at', 'desc');

  return rows.map(toNote);
};

exports.get = async (userId, noteId) => {
  const row = await knex('notes')
    .where({ user_id: userId, id: noteId })
    .select('id', 'user_id', 'title_ciphertext', 'body_ciphertext', 'created_at', 'updated_at')
    .first();

  return row ? toNote(row) : null;
};

exports.create = async (userId, { title, body }) => {
  const id = crypto.randomUUID();
  const [row] = await knex('notes')
    .insert({
      id,
      user_id: userId,
      title_ciphertext: encrypt(title, `${userId}:${id}:title`),
      body_ciphertext: encrypt(body, `${userId}:${id}:body`)
    })
    .returning(['id', 'user_id', 'title_ciphertext', 'body_ciphertext', 'created_at', 'updated_at']);

  return toNote(row);
};

exports.update = async (userId, noteId, { title, body }) => {
  const [row] = await knex('notes')
    .where({ id: noteId, user_id: userId })
    .update({
      title_ciphertext: encrypt(title, `${userId}:${noteId}:title`),
      body_ciphertext: encrypt(body, `${userId}:${noteId}:body`),
      updated_at: knex.fn.now()
    })
    .returning(['id', 'user_id', 'title_ciphertext', 'body_ciphertext', 'created_at', 'updated_at']);

  return row ? toNote(row) : null;
};

exports.remove = async (userId, noteId) => {
  const deleted = await knex('notes').where({ id: noteId, user_id: userId }).delete();
  return deleted > 0;
};
