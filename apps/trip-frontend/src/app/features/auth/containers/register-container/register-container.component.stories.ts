import type { Meta, StoryObj } from '@storybook/angular';
import { RegisterContainerComponent } from './register-container.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<RegisterContainerComponent> = {
  title: 'Auth/Register Container',
  component: RegisterContainerComponent,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<RegisterContainerComponent>;

export const Default: Story = {
  args: {},
};

export const FullPageLayout: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Check that the main elements are present
    await expect(canvas.getByText('Trip Planner')).toBeInTheDocument();
    await expect(
      canvas.getByText('Create your account to start planning amazing trips.'),
    ).toBeInTheDocument();
    await expect(canvas.getByText('Create Account')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  },
};
