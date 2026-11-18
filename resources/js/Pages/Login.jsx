import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import Cube3D from '../Components/Cube3D';

const NO_MOVES = [];

export default function Login({ googleClientId }) {
    const buttonRef = useRef(null);
    const cubeAnchorRef = useRef(null);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!googleClientId) {
            return;
        }

        const script = document.createElement('script');

        script.src = 'https://accounts.google.com/gsi/client?hl=en';
        script.async = true;
        script.onload = () => {
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: async (response) => {
                    setSubmitting(true);
                    setError(null);

                    try {
                        await window.axios.post('/auth/google', {
                            credential: response.credential,
                        });
                        router.reload();
                    } catch (err) {
                        setError(
                            err.response?.data?.message ??
                                'Sign-in failed — please try again.'
                        );
                        setSubmitting(false);
                    }
                },
            });

            window.google.accounts.id.renderButton(buttonRef.current, {
                theme: 'outline',
                size: 'large',
                width: 280,
                text: 'signin_with',
                locale: 'en',
            });
        };
        document.head.appendChild(script);

        return () => {
            window.google?.accounts?.id?.cancel();
            script.remove();
        };
    }, [googleClientId]);

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a0c] md:flex-row">
            <div className="relative hidden flex-1 flex-col overflow-hidden md:flex">
                <div ref={cubeAnchorRef} className="absolute inset-0" />
                <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-white/5 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-40 right-0 size-96 rounded-full bg-indigo-500/10 blur-3xl" />
            </div>

            <div className="relative flex flex-1 flex-col overflow-hidden px-4 py-12">
                <div className="pointer-events-none absolute -right-40 -top-40 size-[28rem] rounded-full bg-indigo-500/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-48 -left-32 size-[24rem] rounded-full bg-cyan-500/10 blur-3xl" />

                <div className="relative z-20 flex flex-col items-center pt-4 text-center animate-[rise_0.5s_ease-out]">
                    <div className="flex items-center gap-3">
                        <img
                            src="/AlgoRhythm_Transparent.png"
                            alt=""
                            className="size-8 rounded-xl bg-white/5 p-1.5 ring-1 ring-white/10"
                        />
                        <div className="bg-gradient-to-b from-white to-white/50 bg-clip-text font-mono text-4xl font-semibold tracking-wide text-transparent">
                            AlgoRhythm
                        </div>
                        <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40 ring-1 ring-white/10">
                            Beta
                        </span>
                    </div>
                    <p className="mt-4 max-w-sm text-lg leading-relaxed text-white/40">
                        Train smart. Solve faster.
                    </p>
                </div>

                <div className="relative flex flex-1 flex-col items-center justify-center">
                    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e12]/95 shadow-2xl shadow-black/60 backdrop-blur-2xl animate-[rise_0.5s_ease-out]">
                        <div className="pointer-events-none absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
                        <div className="relative p-8">
                            <div className="flex flex-col items-center">
                                <img
                                    src="/AlgoRhythm_Transparent.png"
                                    alt="AlgoRhythm logo"
                                    className="mb-5 size-14 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10"
                                />
                                <div className="text-[1.75rem] font-semibold tracking-tight text-white">
                                    Welcome back
                                </div>
                                <p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-white/45">
                                    Sign in to keep your solves in sync
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
                                    {error}
                                </div>
                            )}

                            <div className="mt-8 flex flex-col items-center gap-4">
                                {submitting && (
                                    <div className="flex h-11 items-center text-sm text-white/40">
                                        Signing in…
                                    </div>
                                )}
                                {/* Kept mounted while submitting: Google renders its button into
                                    this node once, so a remount would leave it empty after an error. */}
                                <div ref={buttonRef} className={submitting ? 'hidden' : undefined} />
                            </div>

                            <div className="mt-6 flex items-center gap-4">
                                <div className="h-px flex-1 bg-white/8" />
                                <span className="text-[11px] uppercase tracking-[0.2em] text-white/30">
                                    or
                                </span>
                                <div className="h-px flex-1 bg-white/8" />
                            </div>

                            <div className="mt-6 flex justify-center">
                                <a
                                    href="/"
                                    className="inline-flex rounded-full border border-white/10 px-6 py-2.5 text-sm text-white/55 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                                >
                                    Continue as guest
                                </a>
                            </div>

                            <p className="mt-6 text-center text-[11px] leading-relaxed text-white/30">
                                Your solves sync privately to this Google account.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Cube3D
                auto
                placement="center"
                size={3}
                moves={NO_MOVES}
                brightness={1.5}
                canvasClass="fixed z-10 block aspect-square w-72 opacity-100 transition duration-300 sm:w-[30rem] lg:w-[38rem]"
                anchorRef={cubeAnchorRef}
            />
        </div>
    );
}
