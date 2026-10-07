import { useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStoredSeller, loginSeller, registerSeller } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Atlas Seller" },
      { name: "description", content: "Acesse sua conta do Atlas Seller." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && getStoredSeller()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-20%] h-[60%] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.15),transparent_60%)]"
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-gold" />
          <div>
            <p className="text-lg font-bold tracking-tight">Atlas Seller</p>
            <p className="text-xs text-muted-foreground">
              Inteligência para suas vendas, em um só lugar.
            </p>
          </div>
        </div>
        <Card className="border-border bg-card shadow-2xl">
          <CardContent className="p-6">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-6">
                <LoginForm />
              </TabsContent>
              <TabsContent value="register" className="mt-6">
                <RegisterForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Preenche o email do reset com o mesmo digitado no formulário
  const handleForgotClick = () => {
    setResetEmail(email || "");
    setShowReset(true);
    setResetSent(false);
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Informe seu email");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Link de redefinição enviado para seu email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar email");
    } finally {
      setResetLoading(false);
    }
  };

  // Se o reset foi enviado, mostra tela de confirmação
  if (showReset) {
    if (resetSent) {
      return (
        <div className="space-y-4 text-center">
          <div className="text-3xl">📬</div>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de redefinição de senha para <strong>{resetEmail}</strong>.
            Verifique sua caixa de entrada e spam.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setShowReset(false); setResetSent(false); }}
          >
            Voltar ao login
          </Button>
        </div>
      );
    }

    return (
      <form className="space-y-4" onSubmit={handleSendReset}>
        <p className="text-sm text-muted-foreground">
          Digite seu email cadastrado e enviaremos um link para redefinir sua senha.
        </p>
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            required
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>
        <Button
          type="submit"
          disabled={resetLoading}
          className="w-full bg-gradient-gold font-semibold text-[color:var(--primary-foreground)] hover:opacity-90"
        >
          {resetLoading ? "Enviando..." : "Enviar link de redefinição"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setShowReset(false)}
        >
          Voltar
        </Button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          await loginSeller(email, password);
          toast.success("Bem-vindo!");
          navigate({ to: "/dashboard" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Falha no login");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <button
            type="button"
            onClick={handleForgotClick}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-gold font-semibold text-[color:var(--primary-foreground)] hover:opacity-90"
      >
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

function RegisterForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Regras de senha conforme política Amazon SP-API
  const rules = {
    minLength: password.length >= 12,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\;'`~]/.test(password),
  };
  const allRulesMet = Object.values(rules).every(Boolean);
  const passwordsMatch = password === confirm;
  const canSubmit = allRulesMet && passwordsMatch && name && email;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!allRulesMet) {
          toast.error("A senha não atende aos requisitos de segurança");
          return;
        }
        if (!passwordsMatch) {
          toast.error("Senhas não coincidem");
          return;
        }
        setLoading(true);
        try {
          await registerSeller(name, email, password);
          toast.success("Conta criada!");
          navigate({ to: "/dashboard" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Falha no cadastro");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-email">Email</Label>
        <Input
          id="r-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-password">Senha</Label>
        <Input
          id="r-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {/* ✅ Indicador de força da senha */}
        <ul className="space-y-1 pt-1">
          <RequirementLabel met={rules.minLength} text="Mínimo 12 caracteres" />
          <RequirementLabel met={rules.hasUpper} text="Uma letra maiúscula" />
          <RequirementLabel met={rules.hasLower} text="Uma letra minúscula" />
          <RequirementLabel met={rules.hasNumber} text="Um número" />
          <RequirementLabel met={rules.hasSpecial} text="Um caractere especial (!@#$% etc.)" />
        </ul>
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-confirm">Confirmar senha</Label>
        <Input
          id="r-confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {confirm && !passwordsMatch && (
          <p className="text-xs text-destructive">Senhas não coincidem</p>
        )}
      </div>
      <Button
        type="submit"
        disabled={loading || !canSubmit}
        className="w-full bg-gradient-gold font-semibold text-[color:var(--primary-foreground)] hover:opacity-90"
      >
        {loading ? "Criando..." : "Criar conta"}
      </Button>
    </form>
  );
}

// ✅ Componente auxiliar para exibir requisito de senha
function RequirementLabel({ met, text }: { met: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className={met ? "text-[color:var(--success)]" : "text-muted-foreground"}>
        {met ? "✓" : "○"}
      </span>
      <span className={met ? "text-[color:var(--success)]" : "text-muted-foreground"}>
        {text}
      </span>
    </li>
  );
}