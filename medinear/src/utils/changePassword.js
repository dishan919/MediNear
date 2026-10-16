import { validatePassword } from './authValidation.js';

export function validatePasswordChange(values) {
  const errors = {};
  if (!values.currentPassword) errors.currentPassword = 'Current password is required.';
  const problem = validatePassword(values.newPassword);
  if (problem) errors.newPassword = problem;
  if (!values.confirmPassword) errors.confirmPassword = 'Please confirm your new password.';
  else if (values.newPassword !== values.confirmPassword) errors.confirmPassword = 'New passwords do not match.';
  return errors;
}

// Synchronous lock protects against double submits before React renders busy state.
export function createPasswordSubmission(api, callbacks, token) {
  let pending = false, active = true;
  return {
    activate() { active = true; },
    dispose() { active = false; },
    async submit(values) {
      if (pending || !active) return;
      const errors = validatePasswordChange(values);
      callbacks.errors(errors);
      if (Object.keys(errors).length) return;
      pending = true; callbacks.busy(true); callbacks.error('');
      try {
        await api.patch('/users/password', { currentPassword: values.currentPassword, newPassword: values.newPassword }, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (active) callbacks.success();
      } catch (error) {
        if (!active) return;
        const data = error.response?.data;
        if (data?.errors && [400, 409].includes(error.response.status)) callbacks.errors(data.errors);
        else callbacks.error([400, 401, 409].includes(error.response?.status) ? data?.message || 'Unable to change password. Please try again.' : 'Unable to change password. Please check your connection and try again.');
      } finally {
        pending = false;
        if (active) callbacks.busy(false);
      }
    },
  };
}
