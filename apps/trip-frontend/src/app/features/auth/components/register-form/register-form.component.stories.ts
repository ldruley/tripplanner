import type { Meta, StoryObj } from '@storybook/angular';
import { RegisterFormComponent } from './register-form.component';
import { fn } from '@storybook/test';
import { within, userEvent } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<RegisterFormComponent> = {
  title: 'Auth/Register Form',
  component: RegisterFormComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isLoading: {
      control: { type: 'boolean' },
    },
    error: {
      control: { type: 'text' },
    },
    registerSubmit: { action: 'registerSubmit' },
  },
  args: {
    registerSubmit: fn(),
  },
};

export default meta;
type Story = StoryObj<RegisterFormComponent>;

// Default story
export const Default: Story = {
  args: {
    isLoading: false,
    error: null,
  },
};

// Loading state
export const Loading: Story = {
  args: {
    isLoading: true,
    error: null,
  },
};

// With error
export const WithError: Story = {
  args: {
    isLoading: false,
    error: 'An account with this email already exists',
  },
};

// With validation errors
export const WithValidationErrors: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Try to submit the form without filling it out
    const submitButton = canvas.getByRole('button', { name: /create account/i });
    await userEvent.click(submitButton);

    // Check that validation errors appear
    await expect(canvas.getByText('First name is required')).toBeInTheDocument();
    await expect(canvas.getByText('Last name is required')).toBeInTheDocument();
    await expect(canvas.getByText('Email is required')).toBeInTheDocument();
    await expect(canvas.getByText('Password is required')).toBeInTheDocument();
  },
};

// Password mismatch
export const PasswordMismatch: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out the form with mismatched passwords
    await userEvent.type(canvas.getByPlaceholderText('First name'), 'John');
    await userEvent.type(canvas.getByPlaceholderText('Last name'), 'Doe');
    await userEvent.type(canvas.getByPlaceholderText('Enter your email'), 'john.doe@example.com');
    await userEvent.type(canvas.getByPlaceholderText('Create a password'), 'password123');
    await userEvent.type(canvas.getByPlaceholderText('Confirm your password'), 'password456');

    // Move focus away to trigger validation
    await userEvent.click(canvas.getByRole('checkbox'));

    // Check that password mismatch error appears
    await expect(canvas.getByText('Passwords do not match')).toBeInTheDocument();
  },
};

// Filled form ready to submit
export const FilledForm: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill out the entire form correctly
    await userEvent.type(canvas.getByPlaceholderText('First name'), 'John');
    await userEvent.type(canvas.getByPlaceholderText('Last name'), 'Doe');
    await userEvent.type(canvas.getByPlaceholderText('Enter your email'), 'john.doe@example.com');
    await userEvent.type(canvas.getByPlaceholderText('Create a password'), 'password123');
    await userEvent.type(canvas.getByPlaceholderText('Confirm your password'), 'password123');
    await userEvent.click(canvas.getByRole('checkbox'));

    // Verify the submit button is enabled
    const submitButton = canvas.getByRole('button', { name: /create account/i });
    await expect(submitButton).not.toBeDisabled();
  },
};

// Password visibility toggle
export const PasswordVisibilityToggle: Story = {
  args: {
    isLoading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const passwordInput = canvas.getByPlaceholderText('Create a password');
    const confirmPasswordInput = canvas.getByPlaceholderText('Confirm your password');

    // Initially passwords should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    // Click toggle buttons
    const toggleButtons = canvas.getAllByRole('button', { name: '' }); // Eye icons don't have text
    await userEvent.click(toggleButtons[0]); // First password toggle
    await userEvent.click(toggleButtons[1]); // Confirm password toggle

    // Now passwords should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(confirmPasswordInput).toHaveAttribute('type', 'text');
  },
};
