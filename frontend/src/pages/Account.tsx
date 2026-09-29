import ProfileCard from "../components/account/ProfileCard";
import AppearanceForm from "../components/account/AppearanceForm";
import ChangeEmailForm from "../components/account/ChangeEmailForm";
import ChangePasswordForm from "../components/account/ChangePasswordForm";

/**
 * "Mon compte": the profile banner on top, then the display settings, then the two security forms
 * side by side (stacked on a narrow window).
 */
export default function Account() {
  return (
    <div className="px-6 py-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Mon compte</h1>

      <div className="space-y-6">
        <ProfileCard />
        <AppearanceForm />
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <ChangeEmailForm />
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
