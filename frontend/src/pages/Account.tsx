import { useAuth } from "../context/AuthContext";
import ChangeEmailForm from "../components/account/ChangeEmailForm";
import ChangePasswordForm from "../components/account/ChangePasswordForm";
import { CARD_CLASS } from "../components/ui/styles";

/** "Mon compte": the signed-in user's profile, and the forms to change their email and password. */
export default function Account() {
  const { user } = useAuth();

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Mon compte</h1>

      <div className={`${CARD_CLASS} p-6 mb-6 max-w-xl`}>
        <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Nom</dt>
          <dd className="text-gray-200">{user?.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="text-gray-200">{user?.email}</dd>
        </dl>
      </div>

      <ChangeEmailForm />
      <ChangePasswordForm />
    </div>
  );
}
