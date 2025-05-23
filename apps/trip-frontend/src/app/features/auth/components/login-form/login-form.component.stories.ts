import type { Meta, StoryObj } from '@storybook/angular';
import { LoginFormComponent } from './login-form.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<LoginFormComponent> = {
  component: LoginFormComponent,
  title: 'LoginFormComponent',
};
export default meta;
type Story = StoryObj<LoginFormComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/login-form works!/gi)).toBeTruthy();
  },
};
